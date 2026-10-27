import { StageScreen } from './StageScreen';

export function PlayerScreen() {
  return <StageScreen variant="normal" route="Player" />;
}
export function YogaScreen() {
  return <StageScreen variant="yoga" route="Yoga" />;
}
export function DanceScreen() {
  return <StageScreen variant="dance" route="Dance" />;
}
