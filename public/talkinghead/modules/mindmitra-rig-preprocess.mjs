// Rig preprocessors adapted from the standalone TalkingHead build.
// Keeps custom Sveta/Olaf GLBs compatible with TalkingHead's expected rig names.

const _SVETA_BONES = {
  'Hip': 'Hips', 'Waist': 'Spine', 'Spine01': 'Spine1', 'Spine02': 'Spine2',
  'NeckTwist01': 'Neck', 'L_Eye': 'LeftEye', 'R_Eye': 'RightEye',
  'L_Clavicle': 'LeftShoulder', 'R_Clavicle': 'RightShoulder',
  'L_Upperarm': 'LeftArm', 'R_Upperarm': 'RightArm',
  'L_Forearm': 'LeftForeArm', 'R_Forearm': 'RightForeArm',
  'L_Hand': 'LeftHand', 'R_Hand': 'RightHand',
  'L_Thumb1': 'LeftHandThumb1', 'L_Thumb2': 'LeftHandThumb2', 'L_Thumb3': 'LeftHandThumb3',
  'L_Index1': 'LeftHandIndex1', 'L_Index2': 'LeftHandIndex2', 'L_Index3': 'LeftHandIndex3',
  'L_Mid1': 'LeftHandMiddle1', 'L_Mid2': 'LeftHandMiddle2', 'L_Mid3': 'LeftHandMiddle3',
  'L_Ring1': 'LeftHandRing1', 'L_Ring2': 'LeftHandRing2', 'L_Ring3': 'LeftHandRing3',
  'L_Pinky1': 'LeftHandPinky1', 'L_Pinky2': 'LeftHandPinky2', 'L_Pinky3': 'LeftHandPinky3',
  'R_Thumb1': 'RightHandThumb1', 'R_Thumb2': 'RightHandThumb2', 'R_Thumb3': 'RightHandThumb3',
  'R_Index1': 'RightHandIndex1', 'R_Index2': 'RightHandIndex2', 'R_Index3': 'RightHandIndex3',
  'R_Mid1': 'RightHandMiddle1', 'R_Mid2': 'RightHandMiddle2', 'R_Mid3': 'RightHandMiddle3',
  'R_Ring1': 'RightHandRing1', 'R_Ring2': 'RightHandRing2', 'R_Ring3': 'RightHandRing3',
  'R_Pinky1': 'RightHandPinky1', 'R_Pinky2': 'RightHandPinky2', 'R_Pinky3': 'RightHandPinky3',
  'L_Thigh': 'LeftUpLeg', 'R_Thigh': 'RightUpLeg', 'L_Calf': 'LeftLeg', 'R_Calf': 'RightLeg',
  'L_Foot': 'LeftFoot', 'R_Foot': 'RightFoot', 'L_ToeBase': 'LeftToeBase', 'R_ToeBase': 'RightToeBase',
};
const _SVETA_MORPHS = {
  'Eye_Blink_L': 'eyeBlinkLeft', 'Eye_Blink_R': 'eyeBlinkRight',
  'Eye_L_Look_L': 'eyeLookOutLeft', 'Eye_L_Look_R': 'eyeLookInLeft',
  'Eye_L_Look_Up': 'eyeLookUpLeft', 'Eye_L_Look_Down': 'eyeLookDownLeft',
  'Eye_R_Look_R': 'eyeLookOutRight', 'Eye_R_Look_L': 'eyeLookInRight',
  'Eye_R_Look_Up': 'eyeLookUpRight', 'Eye_R_Look_Down': 'eyeLookDownRight',
  'Eye_Wide_L': 'eyeWideLeft', 'Eye_Wide_R': 'eyeWideRight',
  'Eye_Squint_L': 'eyeSquintLeft', 'Eye_Squint_R': 'eyeSquintRight',
  'Jaw_Open': 'jawOpen', 'Jaw_L': 'jawLeft', 'Jaw_R': 'jawRight', 'Jaw_Forward': 'jawForward',
  'Mouth_Smile_L': 'mouthSmileLeft', 'Mouth_Smile_R': 'mouthSmileRight',
  'Mouth_Frown_L': 'mouthFrownLeft', 'Mouth_Frown_R': 'mouthFrownRight',
  'Mouth_Dimple_L': 'mouthDimpleLeft', 'Mouth_Dimple_R': 'mouthDimpleRight',
  'Mouth_L': 'mouthLeft', 'Mouth_R': 'mouthRight',
  'Mouth_Press_L': 'mouthPressLeft', 'Mouth_Press_R': 'mouthPressRight',
  'Mouth_Stretch_L': 'mouthStretchLeft', 'Mouth_Stretch_R': 'mouthStretchRight',
  'Mouth_Shrug_Lower': 'mouthShrugLower', 'Mouth_Shrug_Upper': 'mouthShrugUpper',
  'Mouth_Roll_In_Lower_L': 'mouthRollLower', 'Mouth_Roll_In_Upper_L': 'mouthRollUpper',
  'Mouth_Close': 'mouthClose', 'Mouth_Pucker_Up_L': 'mouthPucker', 'Mouth_Funnel_Up_L': 'mouthFunnel',
  'Mouth_Down_Lower_L': 'mouthLowerDownLeft', 'Mouth_Down_Lower_R': 'mouthLowerDownRight',
  'Mouth_Up_Upper_L': 'mouthUpperUpLeft', 'Mouth_Up_Upper_R': 'mouthUpperUpRight',
  'Brow_Drop_L': 'browDownLeft', 'Brow_Drop_R': 'browDownRight',
  'Brow_Raise_Outer_L': 'browOuterUpLeft', 'Brow_Raise_Outer_R': 'browOuterUpRight',
  'Brow_Raise_Inner_L': 'browInnerUp',
  'Cheek_Puff_L': 'cheekPuff', 'Cheek_Raise_L': 'cheekSquintLeft', 'Cheek_Raise_R': 'cheekSquintRight',
  'Nose_Sneer_L': 'noseSneerLeft', 'Nose_Sneer_R': 'noseSneerRight',
  'V_None': 'viseme_sil', 'V_Explosive': 'viseme_PP', 'V_Dental_Lip': 'viseme_FF',
  'V_Tongue_out': 'viseme_TH', 'V_Tongue_Curl_D': 'viseme_DD', 'V_Tongue_Lower': 'viseme_kk',
  'V_Affricate': 'viseme_CH', 'V_Tongue_Narrow': 'viseme_SS', 'V_Tongue_Raise': 'viseme_nn',
  'V_Tongue_Curl_U': 'viseme_RR', 'V_Open': 'viseme_aa', 'V_Wide': 'viseme_E',
  'V_Lip_Open': 'viseme_I', 'V_Tight_O': 'viseme_O', 'V_Tight': 'viseme_U',
};

// MindMitra: Olaf-style Blender rig profile.
// The GLB has a usable "Armature" root, but its control/deform bones and
// shape keys are not in the Mixamo/ARKit/Oculus names TalkingHead expects.
//
// Verified skeleton facts (read from the Olaf.glb JSON chunk; 413 joints):
// - Torso: Upper_Body_FK (child of Armature) → Upper_Body_Mid_CTRL →
//   Body_Stretch.001 → Upper_Body_DFM. Upper_Body_FK also parents
//   FK_Upper_Arm.L/R, so rotating it carries the arms with the body.
// - Head_CTRL is a SIBLING of Upper_Body_FK — the head does not inherit
//   torso motion. Chain: Head_CTRL → Head_CTRLUNparent → Head_Stretch_Lower
//   → Head_DFM → Hair_Main_Rig → hair strands.
// - A literal `Hips` bone exists (PR_Root → Root → Hips → Lower_BODY_FK)
//   but drives only the lower ball + legs.
// - Hair twigs: strand roots Hair / Hair.004 / Hair.015 under Head_DFM.
// - Carrot nose: bones named `Noise`, `Noise.001–003` (Blender typo),
//   parented to the Armature root, not the head.
// - Coal buttons: FK_Coal / FK_Coal.001 / FK_Coal.002 chains, also parented
//   to the Armature root — they do NOT follow torso rotation.
const _OLAF_BONES = {
  'Head_CTRL': 'Head',
  'Eye.L': 'LeftEye',
  'Eye.R': 'RightEye',
  'FK_Upper_Arm.L': 'LeftArm',
  'FK_Lower_arm.L': 'LeftForeArm',
  'FK_Hand.L': 'LeftHand',
  'FK_Upper_Arm.R': 'RightArm',
  'FK_Lower_arm.R': 'RightForeArm',
  'FK_Hand.R': 'RightHand',
  'Thumb_Finger.L': 'LeftHandThumb1',
  'Thumb_Finger.L.002': 'LeftHandThumb2',
  'Thumb_Finger.L.001': 'LeftHandThumb3',
  'Thumb_Finger.R': 'RightHandThumb1',
  'Thumb_Finger.R.002': 'RightHandThumb2',
  'Thumb_Finger.R.001': 'RightHandThumb3',
  'Ring_Finger.L': 'LeftHandRing1',
  'Ring_Finger.L.001': 'LeftHandRing2',
  'Ring_Finger.L.002': 'LeftHandRing3',
  'Ring_Finger.R': 'RightHandRing1',
  'Ring_Finger.R.001': 'RightHandRing2',
  'Ring_Finger.R.002': 'RightHandRing3',
  'Middle_Finger.L': 'LeftHandMiddle1',
  'Middle_Finger.L.002': 'LeftHandMiddle2',
  'Middle_Finger.L.001': 'LeftHandMiddle3',
  'Middle_Finger.R': 'RightHandMiddle1',
  'Middle_Finger.R.002': 'RightHandMiddle2',
  'Middle_Finger.R.001': 'RightHandMiddle3',
  'Index_Finger.L': 'LeftHandIndex1',
  'Index_Finger.L.002': 'LeftHandIndex2',
  'Index_Finger.L.001': 'LeftHandIndex3',
  'Index_Finger.R': 'RightHandIndex1',
  'Index_Finger.R.002': 'RightHandIndex2',
  'Index_Finger.R.001': 'RightHandIndex3',
  'Ä°ndex_Finger.L': 'LeftHandIndex1',
  'Ä°ndex_Finger.L.002': 'LeftHandIndex2',
  'Ä°ndex_Finger.L.001': 'LeftHandIndex3',
  'Ä°ndex_Finger.R': 'RightHandIndex1',
  'Ä°ndex_Finger.R.002': 'RightHandIndex2',
  'Ä°ndex_Finger.R.001': 'RightHandIndex3',
  'İndex_Finger.L': 'LeftHandIndex1',
  'İndex_Finger.L.002': 'LeftHandIndex2',
  'İndex_Finger.L.001': 'LeftHandIndex3',
  'İndex_Finger.R': 'RightHandIndex1',
  'İndex_Finger.R.002': 'RightHandIndex2',
  'İndex_Finger.R.001': 'RightHandIndex3',
};

const compactOlafName = name => String(name || '').replace(/[./\s]/g, '');
const _OLAF_BONES_COMPACT = Object.fromEntries(
  Object.entries(_OLAF_BONES).map(([from, to]) => [compactOlafName(from), to])
);

const _OLAF_POSE_BONES = [
  'Hips', 'Head',
  'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightArm', 'RightForeArm', 'RightHand',
  'LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3',
  'RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3',
  'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3',
  'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3',
  'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3',
  'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3',
  'LeftHandRing1', 'LeftHandRing2', 'LeftHandRing3',
  'RightHandRing1', 'RightHandRing2', 'RightHandRing3'
];
const _OLAF_POSE_PROPS = [
  'Hips.position',
  ..._OLAF_POSE_BONES.map(name => `${name}.quaternion`)
];

const _OLAF_MORPH_CLONES = [
  ['Mouth_Open_O', 'jawOpen', 0.55],
  ['Mouth_Open_O', 'mouthOpen', 0.60],
  ['Mouth_Open_O', 'mouthFunnel', 0.26],
  ['Mouth_Open_O', 'mouthPucker', 0.16],
  ['Mouth_Open_O', 'viseme_aa', 0.62],
  ['Mouth_Open_O', 'viseme_O', 0.45],
  ['Mouth_Open_O', 'viseme_U', 0.32],
  ['Mouth_Open_O', 'viseme_RR', 0.28],
  ['Mouth_Lower_Shape', 'mouthLowerDownLeft', 0.42],
  ['Mouth_Lower_Shape', 'mouthLowerDownRight', 0.42],
  ['Mouth_Lower_Shape', 'mouthStretchLeft', 0.30],
  ['Mouth_Lower_Shape', 'mouthStretchRight', 0.30],
  ['Mouth_Lower_Shape', 'mouthRollLower', 0.22],
  ['Mouth_Lower_Shape', 'viseme_E', 0.48],
  ['Mouth_Lower_Shape', 'viseme_I', 0.38],
  ['Mouth_Lower_Shape', 'viseme_CH', 0.30],
  ['Mouth_Lower_Shape', 'viseme_DD', 0.22],
  ['Mouth_Lower_Shape', 'viseme_FF', 0.18],
  ['Mouth_Lower_Shape', 'viseme_kk', 0.25],
  ['Mouth_Lower_Shape', 'viseme_nn', 0.20],
  ['Mouth_Lower_Shape', 'viseme_SS', 0.22],
  ['Mouth_Lower_Shape', 'viseme_TH', 0.20],
  ['Smile.L', 'mouthSmileLeft', 1.0],
  ['Smile.R', 'mouthSmileRight', 1.0],
  ['Sad.L', 'mouthFrownLeft', 1.0],
  ['Sad.R', 'mouthFrownRight', 1.0],
  ['Small_Left', 'eyeBlinkLeft', 1.0],
  ['Small_Right', 'eyeBlinkRight', 1.0],
  ['Small_Left', 'eyeSquintLeft', 0.65],
  ['Small_Right', 'eyeSquintRight', 0.65],
  ['Big_Left', 'eyeWideLeft', 1.0],
  ['Big_Right', 'eyeWideRight', 1.0],
];
const scaleOlafDrivers = (drivers, weight) => drivers.map(driver => ({
  ...driver,
  weight: (driver.weight || 1) * weight
}));
const _OLAF_OPEN_DRIVERS = [
  { bone: 'Jaw', rotation: { x: 0.24 }, position: { y: -0.006, z: 0.004 } },
  { bone: 'Mouth_Open_O', rotation: { x: 0.16 }, position: { y: -0.035, z: 0.012 } },
  { bone: 'Mouth_CTRL.002', position: { y: -0.020, z: 0.006 } },
  { bone: 'Mouth_CTRL.001', position: { y: -0.014, z: 0.004 } },
  { bone: 'Mouth_DFM_Shape', position: { y: -0.020, z: 0.006 }, scale: { x: 0.030, z: 0.020 } },
  { bone: 'Mouth_DEF.L.005', position: { x: -0.004, y: -0.010 } },
  { bone: 'Mouth_DEF.R.005', position: { x: 0.004, y: -0.010 } },
];
const _OLAF_CLOSE_DRIVERS = [
  { bone: 'Jaw', rotation: { x: -0.10 }, position: { y: 0.004 } },
  { bone: 'Mouth_CTRL.002', position: { y: 0.010, z: -0.004 } },
  { bone: 'Mouth_CTRL.003', position: { y: -0.008, z: -0.003 } },
  { bone: 'Mouth_DFM_Shape', scale: { x: -0.025, z: -0.010 } },
];
const _OLAF_LIP_PRESS_DRIVERS = [
  { bone: 'Jaw', rotation: { x: -0.08 }, position: { y: 0.004 } },
  { bone: 'Mouth_CTRL.002', position: { y: 0.016, z: -0.005 } },
  { bone: 'Mouth_CTRL.003', position: { y: -0.012, z: -0.005 } },
  { bone: 'Mouth_DFM_Shape', scale: { x: -0.036, z: -0.018 } },
  { bone: 'Mouth_Shapes_CTRL.L', position: { x: 0.006, y: -0.004 } },
  { bone: 'Mouth_Shapes_CTRL.R', position: { x: -0.006, y: -0.004 } },
  { bone: 'Mouth_CTRL.L.006', position: { x: 0.006, y: -0.004 } },
  { bone: 'Mouth_CTRL.R.006', position: { x: -0.006, y: -0.004 } },
];
const _OLAF_STRETCH_DRIVERS = [
  { bone: 'Mouth_Shapes_CTRL.L', position: { x: -0.026, y: 0.004 } },
  { bone: 'Mouth_Shapes_CTRL.R', position: { x: 0.026, y: 0.004 } },
  { bone: 'Mouth_CTRL.L.006', position: { x: -0.018 } },
  { bone: 'Mouth_CTRL.R.006', position: { x: 0.018 } },
  { bone: 'Mouth_DFM_Shape', scale: { x: 0.050, z: -0.010 } },
];
const _OLAF_PUCKER_DRIVERS = [
  { bone: 'Mouth_Open_O', position: { z: 0.028 }, rotation: { x: 0.08 } },
  { bone: 'Mouth_DFM_Shape', scale: { x: -0.055, z: 0.045 } },
  { bone: 'Mouth_Shapes_CTRL.L', position: { x: 0.016, z: 0.012 } },
  { bone: 'Mouth_Shapes_CTRL.R', position: { x: -0.016, z: 0.012 } },
  { bone: 'Mouth_CTRL.L.006', position: { x: 0.012, z: 0.010 } },
  { bone: 'Mouth_CTRL.R.006', position: { x: -0.012, z: 0.010 } },
];
const _OLAF_SMILE_LEFT_DRIVERS = [
  { bone: 'Smile.L', position: { x: -0.025, y: 0.020, z: 0.006 } },
  { bone: 'Mouth_CTRL.L.006', position: { x: -0.018, y: 0.014 } },
  { bone: 'Mouth_CTRL.L.014', position: { x: -0.012, y: 0.010 } },
  { bone: 'Mouth_DEF.L.005', position: { x: -0.012, y: 0.010 } },
];
const _OLAF_SMILE_RIGHT_DRIVERS = [
  { bone: 'Smile.R', position: { x: 0.025, y: 0.020, z: 0.006 } },
  { bone: 'Mouth_CTRL.R.006', position: { x: 0.018, y: 0.014 } },
  { bone: 'Mouth_CTRL.R.014', position: { x: 0.012, y: 0.010 } },
  { bone: 'Mouth_DEF.R.005', position: { x: 0.012, y: 0.010 } },
];
const _OLAF_FROWN_LEFT_DRIVERS = [
  { bone: 'Sad.L', position: { x: -0.010, y: -0.020, z: 0.004 } },
  { bone: 'Mouth_CTRL.L.006', position: { y: -0.014 } },
  { bone: 'Mouth_CTRL.L.014', position: { y: -0.010 } },
];
const _OLAF_FROWN_RIGHT_DRIVERS = [
  { bone: 'Sad.R', position: { x: 0.010, y: -0.020, z: 0.004 } },
  { bone: 'Mouth_CTRL.R.006', position: { y: -0.014 } },
  { bone: 'Mouth_CTRL.R.014', position: { y: -0.010 } },
];
const _OLAF_BLINK_LEFT_DRIVERS = [
  { bone: 'CTRL_EyeLid.L', position: { y: -0.018 }, rotation: { x: 0.10 } },
  { bone: 'Upper_Eyelid_CTRL.L', position: { y: -0.016 }, rotation: { x: 0.18 } },
  { bone: 'CTRL_Lower_EyeLid.L', position: { y: 0.008 } },
  { bone: 'Eyelid.L.013', position: { y: -0.006 } },
  { bone: 'Eyelid.L.011', position: { y: -0.006 } },
];
const _OLAF_BLINK_RIGHT_DRIVERS = [
  { bone: 'CTRL_EyeLid.R', position: { y: -0.018 }, rotation: { x: 0.10 } },
  { bone: 'Upper_Eyelid_CTRL.R', position: { y: -0.016 }, rotation: { x: 0.18 } },
  { bone: 'CTRL_Lower_EyeLid.R', position: { y: 0.008 } },
  { bone: 'Eyelid.R.013', position: { y: -0.006 } },
  { bone: 'Eyelid.R.011', position: { y: -0.006 } },
];
const _OLAF_WIDE_LEFT_DRIVERS = [
  { bone: 'Big_Eyeball_Shape.L', scale: { x: 0.050, y: 0.050, z: 0.050 } },
  { bone: 'CTRL_EyeLid.L', position: { y: 0.016 }, rotation: { x: -0.10 } },
  { bone: 'CTRL_Lower_EyeLid.L', position: { y: -0.006 } },
];
const _OLAF_WIDE_RIGHT_DRIVERS = [
  { bone: 'Big_Eyeball_Shape.R', scale: { x: 0.050, y: 0.050, z: 0.050 } },
  { bone: 'CTRL_EyeLid.R', position: { y: 0.016 }, rotation: { x: -0.10 } },
  { bone: 'CTRL_Lower_EyeLid.R', position: { y: -0.006 } },
];
const _OLAF_BROW_LEFT_UP_DRIVERS = [
  { bone: 'Main_Eyeborwn_CTRL.L', position: { y: 0.014 }, rotation: { z: -0.04 } },
  { bone: 'Eyebrown_DFM.L.003', position: { y: 0.008 } },
  { bone: 'Eyebrown_DFM.L.006', position: { y: 0.010 } },
];
const _OLAF_BROW_RIGHT_UP_DRIVERS = [
  { bone: 'Main_Eyeborwn_CTRL.R', position: { y: 0.014 }, rotation: { z: 0.04 } },
  { bone: 'Eyebrown_DFM.R.003', position: { y: 0.008 } },
  { bone: 'Eyebrown_DFM.R.006', position: { y: 0.010 } },
];
const _OLAF_BROW_LEFT_DOWN_DRIVERS = [
  { bone: 'Main_Eyeborwn_CTRL.L', position: { y: -0.012 }, rotation: { z: 0.05 } },
  { bone: 'Eyebrown_DFM.L.003', position: { y: -0.008 } },
];
const _OLAF_BROW_RIGHT_DOWN_DRIVERS = [
  { bone: 'Main_Eyeborwn_CTRL.R', position: { y: -0.012 }, rotation: { z: -0.05 } },
  { bone: 'Eyebrown_DFM.R.003', position: { y: -0.008 } },
];
// Lower lid pushes up + small cheek pull — the Duchenne marker for a
// genuine smile. No upper-lid component so it doesn't read as a blink.
const _OLAF_CHEEK_SQUINT_LEFT_DRIVERS = [
  { bone: 'CTRL_Lower_EyeLid.L', position: { y: 0.012 } },
  { bone: 'Eyelid.L.011', position: { y: 0.004 } },
  { bone: 'Smile.L', position: { x: -0.004, y: 0.008 } },
];
const _OLAF_CHEEK_SQUINT_RIGHT_DRIVERS = [
  { bone: 'CTRL_Lower_EyeLid.R', position: { y: 0.012 } },
  { bone: 'Eyelid.R.011', position: { y: 0.004 } },
  { bone: 'Smile.R', position: { x: 0.004, y: 0.008 } },
];
// Per-side lip-corner press. Reuses the shared mouth-controls subset of
// LIP_PRESS but only nudges the matching side's corner inward, so firing
// L and R together doesn't double the asymmetric pull.
const _OLAF_MOUTH_PRESS_LEFT_DRIVERS = [
  { bone: 'Mouth_CTRL.002', position: { y: 0.008, z: -0.003 } },
  { bone: 'Mouth_CTRL.003', position: { y: -0.006, z: -0.003 } },
  { bone: 'Mouth_Shapes_CTRL.L', position: { x: 0.008, y: -0.003 } },
  { bone: 'Mouth_CTRL.L.006', position: { x: 0.006, y: -0.003 } },
];
const _OLAF_MOUTH_PRESS_RIGHT_DRIVERS = [
  { bone: 'Mouth_CTRL.002', position: { y: 0.008, z: -0.003 } },
  { bone: 'Mouth_CTRL.003', position: { y: -0.006, z: -0.003 } },
  { bone: 'Mouth_Shapes_CTRL.R', position: { x: -0.008, y: -0.003 } },
  { bone: 'Mouth_CTRL.R.006', position: { x: -0.006, y: -0.003 } },
];
// Shrug = single-lip lift. Upper variant lifts upper lip; lower variant
// pushes lower lip up (suppressed-emotion pout).
const _OLAF_SHRUG_LOWER_DRIVERS = [
  { bone: 'Mouth_CTRL.003', position: { y: 0.012, z: -0.002 } },
  { bone: 'Mouth_DFM_Shape', scale: { z: 0.006 } },
];
const _OLAF_SHRUG_UPPER_DRIVERS = [
  { bone: 'Mouth_CTRL.002', position: { y: 0.014, z: -0.003 } },
  { bone: 'Mouth_DFM_Shape', scale: { z: 0.006 } },
];
const _OLAF_MORPH_DRIVERS = {
  // ── Torso: breathing + body sway ─────────────────────────────────
  // TalkingHead's mood anims drive the custom channels chestInhale and
  // bodyRotateX/Y/Z. On standard rigs those distribute into Spine/Spine1
  // pose deltas, which Olaf doesn't map — so his torso used to be frozen.
  // Registering bone drivers keyed on those same channels lets the
  // built-in breathing cycle, idle/speaking sway, mood postures, and the
  // bridge's lean/tilt gestures animate the upper snowball for free.
  // Weights are deliberately a fraction of the head's full-value delta so
  // the body follows the head, not the other way around.
  // (Upper_Body_FK parents the arms, so they ride along; Head_CTRL is a
  // sibling and keeps its own full-value pose delta — no double-counting.)
  chestInhale: [
    { bone: 'Upper_Body_Mid_CTRL', scale: { x: 0.02, y: 0.035, z: 0.03 }, position: { y: 0.004 } },
  ],
  bodyRotateX: [{ bone: 'Upper_Body_FK', rotation: { x: 0.45 } }],
  bodyRotateY: [{ bone: 'Upper_Body_FK', rotation: { y: 0.35 } }],
  bodyRotateZ: [{ bone: 'Upper_Body_FK', rotation: { z: 0.30 } }],
  jawOpen: scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.78),
  mouthOpen: scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.64),
  mouthClose: _OLAF_LIP_PRESS_DRIVERS,
  mouthLowerDownLeft: scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.30),
  mouthLowerDownRight: scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.30),
  mouthRollLower: scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.38),
  mouthRollUpper: scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.30),
  mouthStretchLeft: scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.70),
  mouthStretchRight: scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.70),
  mouthFunnel: [...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.18), ...scaleOlafDrivers(_OLAF_PUCKER_DRIVERS, 0.62)],
  mouthPucker: [...scaleOlafDrivers(_OLAF_PUCKER_DRIVERS, 0.78), ...scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.16)],
  mouthLeft: [{ bone: 'Mouth_DFM_Shape', position: { x: -0.018 } }],
  mouthRight: [{ bone: 'Mouth_DFM_Shape', position: { x: 0.018 } }],
  mouthSmile: [...scaleOlafDrivers(_OLAF_SMILE_LEFT_DRIVERS, 0.75), ...scaleOlafDrivers(_OLAF_SMILE_RIGHT_DRIVERS, 0.75)],
  mouthSmileLeft: _OLAF_SMILE_LEFT_DRIVERS,
  mouthSmileRight: _OLAF_SMILE_RIGHT_DRIVERS,
  mouthFrownLeft: _OLAF_FROWN_LEFT_DRIVERS,
  mouthFrownRight: _OLAF_FROWN_RIGHT_DRIVERS,
  mouthPressLeft: _OLAF_MOUTH_PRESS_LEFT_DRIVERS,
  mouthPressRight: _OLAF_MOUTH_PRESS_RIGHT_DRIVERS,
  mouthDimpleLeft: scaleOlafDrivers(_OLAF_SMILE_LEFT_DRIVERS, 0.40),
  mouthDimpleRight: scaleOlafDrivers(_OLAF_SMILE_RIGHT_DRIVERS, 0.40),
  mouthShrugLower: _OLAF_SHRUG_LOWER_DRIVERS,
  mouthShrugUpper: _OLAF_SHRUG_UPPER_DRIVERS,
  cheekSquintLeft: _OLAF_CHEEK_SQUINT_LEFT_DRIVERS,
  cheekSquintRight: _OLAF_CHEEK_SQUINT_RIGHT_DRIVERS,
  browInnerUp: [...scaleOlafDrivers(_OLAF_BROW_LEFT_UP_DRIVERS, 0.7), ...scaleOlafDrivers(_OLAF_BROW_RIGHT_UP_DRIVERS, 0.7)],
  browOuterUpLeft: _OLAF_BROW_LEFT_UP_DRIVERS,
  browOuterUpRight: _OLAF_BROW_RIGHT_UP_DRIVERS,
  browDownLeft: _OLAF_BROW_LEFT_DOWN_DRIVERS,
  browDownRight: _OLAF_BROW_RIGHT_DOWN_DRIVERS,
  eyeBlinkLeft: _OLAF_BLINK_LEFT_DRIVERS,
  eyeBlinkRight: _OLAF_BLINK_RIGHT_DRIVERS,
  eyesClosed: [..._OLAF_BLINK_LEFT_DRIVERS, ..._OLAF_BLINK_RIGHT_DRIVERS],
  eyeSquintLeft: scaleOlafDrivers(_OLAF_BLINK_LEFT_DRIVERS, 0.45),
  eyeSquintRight: scaleOlafDrivers(_OLAF_BLINK_RIGHT_DRIVERS, 0.45),
  eyeWideLeft: _OLAF_WIDE_LEFT_DRIVERS,
  eyeWideRight: _OLAF_WIDE_RIGHT_DRIVERS,
  eyesLookUp: [
    { bone: 'LeftEye', rotation: { x: -0.18 } },
    { bone: 'RightEye', rotation: { x: -0.18 } },
    { bone: 'CTRL_Eye.L', position: { y: 0.018 } },
    { bone: 'CTRL_Eye.R', position: { y: 0.018 } },
  ],
  eyesLookDown: [
    { bone: 'LeftEye', rotation: { x: 0.18 } },
    { bone: 'RightEye', rotation: { x: 0.18 } },
    { bone: 'CTRL_Eye.L', position: { y: -0.018 } },
    { bone: 'CTRL_Eye.R', position: { y: -0.018 } },
  ],
  eyeLookUpLeft: [{ bone: 'LeftEye', rotation: { x: -0.18 } }, { bone: 'CTRL_Eye.L', position: { y: 0.018 } }],
  eyeLookUpRight: [{ bone: 'RightEye', rotation: { x: -0.18 } }, { bone: 'CTRL_Eye.R', position: { y: 0.018 } }],
  eyeLookDownLeft: [{ bone: 'LeftEye', rotation: { x: 0.18 } }, { bone: 'CTRL_Eye.L', position: { y: -0.018 } }],
  eyeLookDownRight: [{ bone: 'RightEye', rotation: { x: 0.18 } }, { bone: 'CTRL_Eye.R', position: { y: -0.018 } }],
  eyeLookInLeft: [{ bone: 'LeftEye', rotation: { y: -0.20 } }, { bone: 'CTRL_Eye.L', position: { x: -0.018 } }],
  eyeLookOutLeft: [{ bone: 'LeftEye', rotation: { y: 0.20 } }, { bone: 'CTRL_Eye.L', position: { x: 0.018 } }],
  eyeLookInRight: [{ bone: 'RightEye', rotation: { y: 0.20 } }, { bone: 'CTRL_Eye.R', position: { x: 0.018 } }],
  eyeLookOutRight: [{ bone: 'RightEye', rotation: { y: -0.20 } }, { bone: 'CTRL_Eye.R', position: { x: -0.018 } }],
  viseme_sil: [],
  viseme_aa: [...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.72), ...scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.12)],
  viseme_E: [...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.22), ...scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.76), ...scaleOlafDrivers(_OLAF_SMILE_LEFT_DRIVERS, 0.05), ...scaleOlafDrivers(_OLAF_SMILE_RIGHT_DRIVERS, 0.05)],
  viseme_I: [...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.16), ...scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.68), ...scaleOlafDrivers(_OLAF_SMILE_LEFT_DRIVERS, 0.12), ...scaleOlafDrivers(_OLAF_SMILE_RIGHT_DRIVERS, 0.12), ...scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.10)],
  viseme_O: [...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.26), ...scaleOlafDrivers(_OLAF_PUCKER_DRIVERS, 0.86)],
  viseme_U: [...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.12), ...scaleOlafDrivers(_OLAF_PUCKER_DRIVERS, 0.78), ...scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.18)],
  viseme_PP: scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.95),
  viseme_FF: [...scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.52), ...scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.42)],
  viseme_TH: [...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.25), ...scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.35)],
  viseme_DD: [...scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.34), ...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.18)],
  viseme_kk: [...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.30), ...scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.15)],
  viseme_CH: [...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.20), ...scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.38), ...scaleOlafDrivers(_OLAF_PUCKER_DRIVERS, 0.22), ...scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.18)],
  viseme_SS: [...scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.45), ...scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.55)],
  viseme_nn: [...scaleOlafDrivers(_OLAF_LIP_PRESS_DRIVERS, 0.30), ...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.12)],
  viseme_RR: [...scaleOlafDrivers(_OLAF_PUCKER_DRIVERS, 0.38), ...scaleOlafDrivers(_OLAF_STRETCH_DRIVERS, 0.12), ...scaleOlafDrivers(_OLAF_OPEN_DRIVERS, 0.16)],
};

function cloneMorphTarget(obj, sourceName, targetName, scale = 1) {
  const dict = obj.morphTargetDictionary;
  const influences = obj.morphTargetInfluences;
  const attrs = obj.geometry?.morphAttributes;
  if (!dict || !influences || !attrs || dict[targetName] !== undefined) return false;
  const sourceIndex = dict[sourceName];
  if (sourceIndex === undefined) return false;

  let targetIndex = null;
  for (const list of Object.values(attrs)) {
    if (!Array.isArray(list) || !list[sourceIndex]) continue;
    if (targetIndex === null) targetIndex = list.length;
    const clone = list[sourceIndex].clone();
    if (scale !== 1) {
      const array = clone.array;
      for (let i = 0; i < array.length; i++) array[i] *= scale;
    }
    list.push(clone);
  }
  if (targetIndex === null) return false;
  dict[targetName] = targetIndex;
  influences[targetIndex] = 0;
  return true;
}

function hasMorph(obj, name) {
  return !!obj.morphTargetDictionary &&
    Object.prototype.hasOwnProperty.call(obj.morphTargetDictionary, name);
}

function isOlafRig(gltf) {
  const hasArmature = !!gltf.scene.getObjectByName('Armature');
  const hasHeadControl = !!gltf.scene.getObjectByName('Head_CTRL');
  const hasMouthControl = !!gltf.scene.getObjectByName('Jaw') ||
    !!gltf.scene.getObjectByName('Mouth_Open_O') ||
    !!gltf.scene.getObjectByName('Mouth_DFM_Shape');
  let hasOlafShapeKeys = false;
  gltf.scene.traverse(obj => {
    if (hasMorph(obj, 'Mouth_Open_O') && hasMorph(obj, 'Smile.L')) {
      hasOlafShapeKeys = true;
    }
  });
  return hasArmature && hasHeadControl && (hasMouthControl || hasOlafShapeKeys);
}

function preprocessOlafRig(gltf) {
  gltf.userData = gltf.userData || {};
  gltf.scene.userData = gltf.scene.userData || {};
  gltf.userData.talkingHeadRigProfile = 'olaf';
  gltf.scene.userData.talkingHeadRigProfile = 'olaf';
  gltf.userData.talkingHeadPoseMode = 'rest';
  gltf.scene.userData.talkingHeadPoseMode = 'rest';
  gltf.userData.talkingHeadPoseProps = _OLAF_POSE_PROPS;
  gltf.scene.userData.talkingHeadPoseProps = _OLAF_POSE_PROPS;
  gltf.userData.talkingHeadArmRest = { preset: 'down', side: 0.78, down: 0.58, forward: 0.24 };
  gltf.scene.userData.talkingHeadArmRest = { preset: 'down', side: 0.78, down: 0.58, forward: 0.24 };

  // Runtime nose-bone discovery: Olaf's carrot-nose bones are literally
  // named `Noise`/`Noise.001–003` (Blender typo for "Nose"), so the scan
  // matches both spellings. If found, synthesise drivers for
  // noseSneerLeft/Right. Empathy/concern mood baselines already set
  // these morph weights, so the moods automatically engage them once
  // the drivers exist. Silent no-op if no nose bones present.
  const noseBones = [];
  gltf.scene.traverse(obj => {
    if (obj.isBone && /nose|noise/i.test(obj.name)) noseBones.push(obj.name);
  });
  const morphDrivers = { ..._OLAF_MORPH_DRIVERS };
  if (noseBones.length) {
    const isLeft = (n) => /\.L\b|_L\b|left/i.test(n);
    const isRight = (n) => /\.R\b|_R\b|right/i.test(n);
    const isCenter = (n) => !isLeft(n) && !isRight(n);
    const leftBones = [...noseBones.filter(isLeft), ...noseBones.filter(isCenter)];
    const rightBones = [...noseBones.filter(isRight), ...noseBones.filter(isCenter)];
    morphDrivers.noseSneerLeft = leftBones.map(bone => ({
      bone, position: { y: 0.006 }, rotation: { z: -0.04 },
    }));
    morphDrivers.noseSneerRight = rightBones.map(bone => ({
      bone, position: { y: 0.006 }, rotation: { z: 0.04 },
    }));
    console.info('[Olaf] nose drivers wired:', noseBones);
  } else {
    console.info('[Olaf] no nose bones found — noseSneer left as no-op');
  }
  gltf.userData.talkingHeadMorphDrivers = morphDrivers;
  gltf.scene.userData.talkingHeadMorphDrivers = morphDrivers;

  gltf.scene.scale.setScalar(0.165);
  gltf.scene.updateMatrixWorld(true);

  gltf.scene.traverse(obj => {
    if ((obj.isMesh || obj.isSkinnedMesh) && obj.name === 'Head') {
      obj.name = 'Olaf_Head_Mesh';
    }
    const olafBoneName = _OLAF_BONES[obj.name] || _OLAF_BONES_COMPACT[compactOlafName(obj.name)];
    if (olafBoneName) {
      obj.name = olafBoneName;
    }
    if (obj.morphTargetDictionary) {
      _OLAF_MORPH_CLONES.forEach(([source, target, scale]) => {
        cloneMorphTarget(obj, source, target, scale);
      });
    }
  });
}

/**
 * Universal onpreprocess callback. Safe to pass to every showAvatar call;
 * it only changes known Sveta/Olaf rig signatures.
 */
export function mindmitraPreprocess(gltf) {
  if (isOlafRig(gltf)) {
    preprocessOlafRig(gltf);
  }

  gltf.scene.traverse(obj => {
    if (_SVETA_BONES[obj.name]) obj.name = _SVETA_BONES[obj.name];
    if (obj.morphTargetDictionary) {
      const dict = obj.morphTargetDictionary;
      for (const oldKey of Object.keys(dict)) {
        const newKey = _SVETA_MORPHS[oldKey];
        if (newKey && !Object.prototype.hasOwnProperty.call(dict, newKey)) {
          dict[newKey] = dict[oldKey];
          delete dict[oldKey];
        }
      }
    }
  });
}

