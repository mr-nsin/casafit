import { useFonts } from 'expo-font';
import { RobotoFlex_400Regular } from '@expo-google-fonts/roboto-flex';
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';

/** Loads Roboto Flex (Latin) and Noto Sans Devanagari (Hindi). Returns true when ready. */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    RobotoFlex_400Regular,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_700Bold,
  });
  // A font failure must not leave the user on a blank screen; fall back to system fonts.
  return loaded || error != null;
}
