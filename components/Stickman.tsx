import React, { useMemo } from 'react';
import { Sphere, Cylinder } from '@react-three/drei';
import { GroupProps } from '@react-three/fiber';
import { Pose, JointRotation } from '../types';

interface StickmanProps extends GroupProps {
  pose: Pose;
  selectedJoint: string | null;
  onSelectJoint: (jointId: string) => void;
}

const JOINT_COLOR = "#3b82f6"; // Blue
const SELECTED_COLOR = "#facc15"; // Yellow
const BONE_COLOR = "#cbd5e1"; // Slate 300

interface BoneMeshProps {
  height: number;
  radius?: number;
}

const BoneMesh: React.FC<BoneMeshProps> = ({ height, radius = 0.08 }) => (
  <Cylinder args={[radius, radius, height, 16]} position={[0, height / 2, 0]}>
    <meshStandardMaterial color={BONE_COLOR} />
  </Cylinder>
);

interface JointMeshProps {
  id: string;
  selected: boolean;
  onSelect: (id: string) => void;
  radius?: number;
}

const JointMesh: React.FC<JointMeshProps> = ({ id, selected, onSelect, radius = 0.15 }) => (
  <Sphere 
    args={[radius, 16, 16]} 
    onClick={(e) => {
      e.stopPropagation();
      onSelect(id);
    }}
    onPointerOver={() => document.body.style.cursor = 'pointer'}
    onPointerOut={() => document.body.style.cursor = 'auto'}
  >
    <meshStandardMaterial 
      color={selected ? SELECTED_COLOR : JOINT_COLOR} 
      emissive={selected ? SELECTED_COLOR : '#000000'}
      emissiveIntensity={selected ? 0.5 : 0}
    />
  </Sphere>
);

// Helper to convert Euler state to rotation array for R3F
const getRotation = (rot: JointRotation): [number, number, number] => [rot.x, rot.y, rot.z];

export const Stickman: React.FC<StickmanProps> = ({ pose, selectedJoint, onSelectJoint, ...props }) => {
  
  // Helper to safely get rotation or default to 0
  const getRot = (id: string) => pose[id] ? getRotation(pose[id]) : [0, 0, 0] as [number, number, number];
  
  const isSel = (id: string) => selectedJoint === id;

  return (
    <group {...props}>
      {/* Root / Hips */}
      <group position={[0, 3, 0]} rotation={getRot('torso')}>
        <JointMesh id="torso" selected={isSel('torso')} onSelect={onSelectJoint} radius={0.2} />
        
        {/* Upper Body (Spine to Shoulders) */}
        <group position={[0, 0, 0]}>
            {/* Spine Bone */}
            <BoneMesh height={1.5} />
            
            {/* Neck/Head Point */}
            <group position={[0, 1.5, 0]}>
               {/* Head */}
               <group rotation={getRot('head')}>
                  <JointMesh id="head" selected={isSel('head')} onSelect={onSelectJoint} />
                  <group position={[0, 0.5, 0]}>
                    <Sphere args={[0.35, 32, 32]}>
                        <meshStandardMaterial color={BONE_COLOR} />
                    </Sphere>
                    {/* Eyes for orientation */}
                    <Sphere args={[0.05]} position={[0.12, 0.05, 0.3]}>
                        <meshStandardMaterial color="black" />
                    </Sphere>
                    <Sphere args={[0.05]} position={[-0.12, 0.05, 0.3]}>
                        <meshStandardMaterial color="black" />
                    </Sphere>
                  </group>
               </group>

               {/* Shoulders (Connection logic) */}
               {/* Left Arm Chain */}
               <group position={[-0.5, 0, 0]} rotation={getRot('upperArmL')}>
                  <JointMesh id="upperArmL" selected={isSel('upperArmL')} onSelect={onSelectJoint} />
                  <group rotation={[0,0,-1.57]}>
                     <BoneMesh height={1.2} />
                  </group>
                  {/* Elbow */}
                  <group position={[-1.2, 0, 0]} rotation={getRot('lowerArmL')}>
                    <JointMesh id="lowerArmL" selected={isSel('lowerArmL')} onSelect={onSelectJoint} radius={0.12} />
                    <group rotation={[0,0,-1.57]}>
                        <BoneMesh height={1.1} />
                    </group>
                    {/* Hand */}
                    <Sphere args={[0.12]} position={[-1.1, 0, 0]}>
                         <meshStandardMaterial color={BONE_COLOR} />
                    </Sphere>
                  </group>
               </group>

               {/* Right Arm Chain */}
               <group position={[0.5, 0, 0]} rotation={getRot('upperArmR')}>
                  <JointMesh id="upperArmR" selected={isSel('upperArmR')} onSelect={onSelectJoint} />
                  <group rotation={[0,0, 1.57]}>
                     <BoneMesh height={1.2} />
                  </group>
                  {/* Elbow */}
                  <group position={[1.2, 0, 0]} rotation={getRot('lowerArmR')}>
                    <JointMesh id="lowerArmR" selected={isSel('lowerArmR')} onSelect={onSelectJoint} radius={0.12} />
                    <group rotation={[0,0, 1.57]}>
                        <BoneMesh height={1.1} />
                    </group>
                    {/* Hand */}
                    <Sphere args={[0.12]} position={[1.1, 0, 0]}>
                         <meshStandardMaterial color={BONE_COLOR} />
                    </Sphere>
                  </group>
               </group>
            </group>
        </group>

        {/* Lower Body (Hips to Legs) */}
        <group position={[0, 0, 0]}>
            {/* Left Leg Chain */}
            <group position={[-0.4, 0, 0]} rotation={[0,0,Math.PI]}> 
                {/* Rotate 180 to point down, then apply local rotation */}
                <group rotation={getRot('upperLegL')}>
                    <JointMesh id="upperLegL" selected={isSel('upperLegL')} onSelect={onSelectJoint} />
                    <BoneMesh height={1.5} />
                    
                    {/* Knee */}
                    <group position={[0, 1.5, 0]} rotation={getRot('lowerLegL')}>
                         <JointMesh id="lowerLegL" selected={isSel('lowerLegL')} onSelect={onSelectJoint} radius={0.12} />
                         <BoneMesh height={1.5} />
                         {/* Foot */}
                         <group position={[0, 1.5, 0]}>
                             <mesh position={[0, 0, 0.15]} rotation={[0.5,0,0]}>
                                 <boxGeometry args={[0.2, 0.1, 0.4]} />
                                 <meshStandardMaterial color={BONE_COLOR} />
                             </mesh>
                         </group>
                    </group>
                </group>
            </group>

            {/* Right Leg Chain */}
            <group position={[0.4, 0, 0]} rotation={[0,0,Math.PI]}>
                 <group rotation={getRot('upperLegR')}>
                    <JointMesh id="upperLegR" selected={isSel('upperLegR')} onSelect={onSelectJoint} />
                    <BoneMesh height={1.5} />
                    
                    {/* Knee */}
                    <group position={[0, 1.5, 0]} rotation={getRot('lowerLegR')}>
                         <JointMesh id="lowerLegR" selected={isSel('lowerLegR')} onSelect={onSelectJoint} radius={0.12} />
                         <BoneMesh height={1.5} />
                         {/* Foot */}
                         <group position={[0, 1.5, 0]}>
                             <mesh position={[0, 0, 0.15]} rotation={[0.5,0,0]}>
                                 <boxGeometry args={[0.2, 0.1, 0.4]} />
                                 <meshStandardMaterial color={BONE_COLOR} />
                             </mesh>
                         </group>
                    </group>
                </group>
            </group>
        </group>
      </group>
    </group>
  );
};