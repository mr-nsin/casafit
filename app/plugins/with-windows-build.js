// Expo config plugin: keeps the Android build working on Windows.
// Windows caps paths at 260 chars; CMake object paths and pnpm paths blow past it.
// Applies only when prebuild runs on Windows, so macOS/Linux/EAS builds are untouched.
// Without this, `expo prebuild --clean` drops the fixes (android/ is git-ignored).
const {
  withGradleProperties,
  withProjectBuildGradle,
  withAppBuildGradle,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARK = '// casafit-windows-build';
const STAGING = process.env.CASAFIT_CMAKE_STAGING || 'D:/cx';

function setProp(props, key, value) {
  const hit = props.find((p) => p.type === 'property' && p.key === key);
  if (hit) hit.value = value;
  else props.push({ type: 'property', key, value });
}

module.exports = function withWindowsBuild(config) {
  if (process.platform !== 'win32') return config;

  config = withGradleProperties(config, (c) => {
    setProp(c.modResults, 'org.gradle.jvmargs', '-Xmx3072m -XX:MaxMetaspaceSize=768m');
    setProp(c.modResults, 'kotlin.compiler.execution.strategy', 'in-process');
    setProp(c.modResults, 'android.compileSdkVersion', '37');
    return c;
  });

  config = withProjectBuildGradle(config, (c) => {
    if (c.modResults.contents.includes(MARK)) return c;
    c.modResults.contents += `
${MARK}
subprojects { sub ->
  // CMake hashes long object paths in every library (Windows 260-char limit)
  sub.plugins.withId('com.android.library') {
    sub.android.defaultConfig.externalNativeBuild.cmake.arguments('-DCMAKE_OBJECT_PATH_MAX=120')
  }
  if (sub.name == 'react-native-reanimated') {
    sub.plugins.withId('com.android.library') {
      sub.android.externalNativeBuild.cmake.buildStagingDirectory = new File('${STAGING}/reanimated')
    }
  }
}
`;
    return c;
  });

  config = withAppBuildGradle(config, (c) => {
    let src = c.modResults.contents;
    if (src.includes(MARK)) return c;
    src = src.replace(
      /\nandroid \{/,
      `\nandroid {\n    ${MARK}\n    externalNativeBuild { cmake { buildStagingDirectory = file('${STAGING}/app') } }`,
    );
    src = src.replace(
      /defaultConfig \{/,
      'defaultConfig {\n        externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=120" } }',
    );
    c.modResults.contents = src;
    return c;
  });

  // Gradle wrapper download times out behind slow proxies at the 10 s default.
  config = withDangerousMod(config, [
    'android',
    (c) => {
      const f = path.join(c.modRequest.platformProjectRoot, 'gradle/wrapper/gradle-wrapper.properties');
      if (fs.existsSync(f)) {
        let s = fs.readFileSync(f, 'utf8');
        s = /networkTimeout=/.test(s) ? s.replace(/networkTimeout=\d+/, 'networkTimeout=600000') : s + '\nnetworkTimeout=600000\n';
        fs.writeFileSync(f, s);
      }
      return c;
    },
  ]);

  return config;
};
