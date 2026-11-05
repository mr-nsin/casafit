export type { CasafitPose } from './CasafitPose.nitro';
export const POSE_LANDMARK_COUNT = 33;
/** x, y, z, visibility */
export const POSE_FLOATS_PER_LANDMARK = 4;
/** 33 image landmarks then 33 world landmarks. */
export const POSE_BUFFER_FLOATS = POSE_LANDMARK_COUNT * POSE_FLOATS_PER_LANDMARK * 2;
