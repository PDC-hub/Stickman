export interface Vector3 {
    x: number;
    y: number;
    z: number;
  }
  
  export interface JointRotation {
    x: number;
    y: number;
    z: number;
  }
  
  // A dictionary mapping joint IDs (e.g., "head", "leftArm") to their rotations
  export type Pose = Record<string, JointRotation>;
  
  export interface Keyframe {
    id: string;
    pose: Pose;
    duration: number; // Duration to reach this frame from the previous one (ms)
  }
  
  export const INITIAL_POSE: Pose = {
    torso: { x: 0, y: 0, z: 0 },
    head: { x: 0, y: 0, z: 0 },
    upperArmL: { x: 0, y: 0, z: -0.5 },
    lowerArmL: { x: 0, y: 0, z: 0 },
    upperArmR: { x: 0, y: 0, z: 0.5 },
    lowerArmR: { x: 0, y: 0, z: 0 },
    upperLegL: { x: 0, y: 0, z: -0.2 },
    lowerLegL: { x: 0, y: 0, z: 0 },
    upperLegR: { x: 0, y: 0, z: 0.2 },
    lowerLegR: { x: 0, y: 0, z: 0 },
  };
  
  export const JOINT_CONFIG = [
    { id: 'torso', name: 'Torso/Waist' },
    { id: 'head', name: 'Head' },
    { id: 'upperArmL', name: 'Left Shoulder' },
    { id: 'lowerArmL', name: 'Left Elbow' },
    { id: 'upperArmR', name: 'Right Shoulder' },
    { id: 'lowerArmR', name: 'Right Elbow' },
    { id: 'upperLegL', name: 'Left Hip' },
    { id: 'lowerLegL', name: 'Left Knee' },
    { id: 'upperLegR', name: 'Right Hip' },
    { id: 'lowerLegR', name: 'Right Knee' },
  ];