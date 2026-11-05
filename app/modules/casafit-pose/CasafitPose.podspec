# UNBUILT: written to the same Nitro spec as Android, but there is no Mac in this repo's toolchain.
# First build on a Mac or EAS is the iOS day-1 gate in docs/plans/spikes/pose.md section 9.
require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "CasafitPose"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/mr-nsin/casafit"
  s.license      = { :type => "UNLICENSED" }
  s.authors      = "CasaFit"

  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/mr-nsin/casafit.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
  ]
  # The bundled model. Loaded with Bundle(for:), never downloaded.
  s.resources = ["assets/pose_landmarker_lite.task"]
  s.frameworks = ["AVFoundation", "CoreMedia", "CoreVideo"]

  load 'nitrogen/generated/ios/CasafitPose+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'VisionCamera'
  # UNVERIFIED version: the CocoaPods CDN was not reachable from the build machine. Pick the release
  # that matches Android tasks-vision 1.1.1 when first building on a Mac, then pin it exactly.
  s.dependency 'MediaPipeTasksVision'
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
