import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Sparkles, Award, RotateCw, Focus, Compass, 
  ArrowUp, ArrowDown, Info, Trash2, Check, 
  HelpCircle, Shield, Play, Lock, FileText, FileSpreadsheet, Image,
  Sliders, Layers, Eye, X, ChevronRight, ChevronLeft, Activity, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../../components/NotificationProvider';

// ============================================================
// TOOTH STATE COLORS
// ============================================================
const STATE_COLORS = {
  healthy: 0xfefefe,
  decay: 0xef4444,
  restored: 0x3b82f6,
  crown: 0xfbbf24,
  implant: 0x9ca3af,
  missing: 0x1e293b,
  treatment: 0xf59e0b,
};

const TOOTH_NAMES: Record<string, string> = {
  'central_incisor': 'Central Incisor',
  'lateral_incisor': 'Lateral Incisor',
  'canine': 'Canine',
  'first_premolar': 'First Premolar',
  'second_premolar': 'Second Premolar',
  'first_molar': 'First Molar',
  'second_molar': 'Second Molar',
  'third_molar': 'Third Molar',
};

const TOOTH_DESC: Record<string, string> = {
  'central_incisor': 'The front-most teeth, designed for cutting and biting into food. Most visible when smiling.',
  'lateral_incisor': 'Located beside the central incisors, these assist in gripping and tearing food.',
  'canine': 'Pointed teeth at the corner of the dental arch, designed for tearing and gripping food.',
  'first_premolar': 'Transitional teeth between canines and molars, used for both tearing and grinding.',
  'second_premolar': 'Located behind the first premolars, these help grind food before reaching the molars.',
  'first_molar': 'Large flat teeth responsible for grinding food. The first molars appear around age 6.',
  'second_molar': 'Located behind the first molars, these complete the main grinding surface.',
  'third_molar': 'Also known as wisdom teeth, these often appear in early adulthood and may require extraction.',
};

// FDI state colors as hex strings
const STATE_HEX_COLORS = {
  healthy: '#ffffff',
  decay: '#ef4444',
  restored: '#3b82f6',
  crown: '#fbbf24',
  implant: '#9ca3af',
  missing: '#1e293b',
  treatment: '#f59e0b',
};

const tourSegments = [
  {
    title: "Interactive 3D Stage (1/6)",
    text: "This is your core three-dimensional workspace. Drag with your cursor to orbit around the teeth arch, scroll to zoom, or click a tooth to inspect detail condition parameters.",
    selector: "section-viewer",
  },
  {
    title: "3D View Modes (2/6)",
    text: "Toggle instantly between Realistic color, X-Ray (to render teeth translucent and reveal soft pulsing root nerves), and Condition Map (to see uncompromised teeth as skeletal wireframes, isolating active pathologies).",
    selector: "tour-view-modes",
  },
  {
    title: "Bite & Occlusion Simulator (3/6)",
    text: "Simulate natural jaw opening, TMJ hinging, and orthodontic occlusion lines with real-time horizontal plane slider adjustments.",
    selector: "tour-occlusion",
  },
  {
    title: "FDI Linear Dental Chart (4/6)",
    text: "An interactive, linear orthodontic grid mapping system. Easily trace tooth indices, review existing restorations, or tag periodontal pathology quadrants.",
    selector: "section-chart",
  },
  {
    title: "Aesthetic Prognosis reveal (5/6)",
    text: "Compare patient baseline decay states against customized pre-planned ceramic restoration goals using a dynamic before/after dual-pane overlay reveal slider.",
    selector: "section-prognosis",
  },
  {
    title: "Interactive Treatment Cost Calculator (6/6)",
    text: "Customize treatment listings, filter categories (Restorative, Preventive, Cosmetic, Surgical) and instantly compile patient out-of-pocket, tax, and insurance coverage estimations.",
    selector: "tour-cost",
  }
];

export default function ThreeDModel() {
  const { notify } = useNotification();
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // App States
  const [isPediatric, setIsPediatric] = useState(false);
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null);
  const [toothState, setToothState] = useState<Record<number, string>>({});
  const [viewMode, setViewMode] = useState<'both' | 'upper' | 'lower' | 'left' | 'right' | 'anterior' | 'focus'>('both');
  const [isExploded, setIsExploded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeTab, setActiveTab] = useState<'explorer' | 'cost' | 'education'>('explorer');

  // Interactive timeline in the Detail panel
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [timelineProgress, setTimelineProgress] = useState(0);

  // Before/After simulator slider
  const [baSliderPercent, setBaSliderPercent] = useState(50);
  const baContainerRef = useRef<HTMLDivElement>(null);

  // NEW FEATURES STATES:
  const [isTransparent, setIsTransparent] = useState(false);
  const [isCrossSection, setIsCrossSection] = useState(false);
  const [renderMode3D, setRenderMode3D] = useState<'realistic' | 'xray' | 'condition'>('realistic');
  const [biteOcclusion, setBiteOcclusion] = useState(100); // 0 (open/exploded) to 100 (fully closed)
  const [hoveredTooth, setHoveredTooth] = useState<{ fdi: number; name: string; state: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [treatmentCategory, setTreatmentCategory] = useState<'all' | 'restorative' | 'cosmetic' | 'surgical' | 'preventive'>('all');
  const [activeSection, setActiveSection] = useState('section-viewer');
  const [tourStep, setTourStep] = useState<number | null>(null);

  // Cost estimator list of procedures state - with categories
  const [procedures, setProcedures] = useState([
    { id: 'filling', name: 'Composite Filling', tooth: 'FDI 16', cost: 180, lab: 0, material: 45, included: false, category: 'restorative' },
    { id: 'rootcanal', name: 'Root Canal Treatment', tooth: 'FDI 23', cost: 900, lab: 0, material: 120, included: false, category: 'restorative' },
    { id: 'crown', name: 'Ceramic Crown', tooth: 'FDI 14', cost: 1200, lab: 380, material: 220, included: true, category: 'restorative' },
    { id: 'veneer', name: 'Porcelain Veneer', tooth: 'FDI 11', cost: 1400, lab: 420, material: 280, included: false, category: 'cosmetic' },
    { id: 'implant', name: 'Dental Implant', tooth: 'FDI 46', cost: 3500, lab: 800, material: 600, included: true, category: 'surgical' },
    { id: 'whitening', name: 'Professional Whitening', tooth: 'Full Arch', cost: 450, lab: 0, material: 90, included: false, category: 'cosmetic' },
    { id: 'scaling', name: 'Scaling & Polishing', tooth: 'Full Mouth', cost: 220, lab: 0, material: 0, included: true, category: 'preventive' },
    { id: 'extraction', name: 'Surgical Extraction', tooth: 'FDI 38', cost: 250, lab: 0, material: 35, included: false, category: 'surgical' },
  ]);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const teethMeshesRef = useRef<THREE.Group[]>([]);
  const upperArchRef = useRef<THREE.Group | null>(null);
  const lowerArchRef = useRef<THREE.Group | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);

  // Initial Demo States
  useEffect(() => {
    const demoStates: Record<number, string> = {
      16: 'decay',
      14: 'crown',
      23: 'decay',
      36: 'restored',
      46: 'treatment',
      11: 'treatment',
    };
    setToothState(demoStates);
  }, []);

  // Update tooth color/materials in Three.js scene when toothState, renderMode3D, isTransparent, or isCrossSection changes
  useEffect(() => {
    teethMeshesRef.current.forEach(tooth => {
      const fdi = tooth.userData.fdi;
      const state = toothState[fdi] || 'healthy';
      setToothStateInScene(tooth, state, renderMode3D);
    });
  }, [toothState, isPediatric, renderMode3D, isTransparent, isCrossSection]);

  // Handle Pediatric switch (rebuild mouth group in background helper)
  useEffect(() => {
    if (sceneRef.current) {
      buildMouth();
    }
  }, [isPediatric]);

  // Adjust positioning according to occlusion slider and exploded mode in real-time
  useEffect(() => {
    if (upperArchRef.current && lowerArchRef.current) {
      const openRatio = (100 - biteOcclusion) / 100; // 0 when closed, 1 when fully open
      const explodedOffset = isExploded ? 0.75 : 0.0;
      
      // Real-time animation of vertical translation
      upperArchRef.current.position.y = 0.3 + (openRatio * 0.45) + explodedOffset;
      lowerArchRef.current.position.y = -0.3 - (openRatio * 0.45) - explodedOffset;
      
      // Simulate highly realistic hinge rotation of the lower jaw for orthodontic display
      lowerArchRef.current.rotation.x = - (openRatio * 0.22);
    }
  }, [biteOcclusion, isExploded]);

  // Handle View Mode filtering
  useEffect(() => {
    if (upperArchRef.current && lowerArchRef.current) {
      if (viewMode === 'upper') {
        upperArchRef.current.visible = true;
        lowerArchRef.current.visible = false;
      } else if (viewMode === 'lower') {
        upperArchRef.current.visible = false;
        lowerArchRef.current.visible = true;
      } else {
        upperArchRef.current.visible = true;
        lowerArchRef.current.visible = true;
      }

      // Handle individual tooth/mesh visibility within the arches matching advanced viewMode specifications
      teethMeshesRef.current.forEach(tooth => {
        const fdi = tooth.userData.fdi;
        if (!fdi) return;
        const firstDigit = Math.floor(fdi / 10);
        const lastDigit = fdi % 10;
        
        // FDI Quadrants: 1, 4, 5, 8 are Patient's Right; 2, 3, 6, 7 are Patient's Left
        const isRight = [1, 4, 5, 8].includes(firstDigit);
        const isLeft = [2, 3, 6, 7].includes(firstDigit);
        const isAnterior = lastDigit <= 3; // incisors and canines

        let isToothVisible = true;

        if (viewMode === 'upper' && !tooth.userData.isUpper) {
          isToothVisible = false;
        } else if (viewMode === 'lower' && tooth.userData.isUpper) {
          isToothVisible = false;
        } else if (viewMode === 'right' && !isRight) {
          isToothVisible = false;
        } else if (viewMode === 'left' && !isLeft) {
          isToothVisible = false;
        } else if (viewMode === 'anterior' && !isAnterior) {
          isToothVisible = false;
        } else if (viewMode === 'focus') {
          if (selectedFdi !== null) {
            isToothVisible = (fdi === selectedFdi);
          } else {
            isToothVisible = true;
          }
        }

        tooth.visible = isToothVisible;

        // Apply fallback hiding for missing states to ensure consistency
        const state = toothState[fdi] || 'healthy';
        if (state === 'missing') {
          if (tooth.userData.crownMesh) tooth.userData.crownMesh.visible = false;
          if (tooth.userData.dentinMesh) tooth.userData.dentinMesh.visible = false;
          if (tooth.userData.pulpMesh) tooth.userData.pulpMesh.visible = false;
          if (tooth.userData.rootMeshes) {
            tooth.userData.rootMeshes.forEach((r: THREE.Mesh) => r.visible = false);
          }
        }
      });
    }
  }, [viewMode, selectedFdi, toothState, isPediatric]);

  // Active Scroll-Spy Section tracking
  useEffect(() => {
    const handleScroll = () => {
      const viewerEl = document.getElementById('section-viewer');
      const chartEl = document.getElementById('section-chart');
      const prognosisEl = document.getElementById('section-prognosis');
      const complianceEl = document.getElementById('section-compliance');

      const scrollPos = window.scrollY + 220;

      if (complianceEl && scrollPos >= complianceEl.offsetTop) {
        setActiveSection('section-compliance');
      } else if (prognosisEl && scrollPos >= prognosisEl.offsetTop) {
        setActiveSection('section-prognosis');
      } else if (chartEl && scrollPos >= chartEl.offsetTop) {
        setActiveSection('section-chart');
      } else {
        setActiveSection('section-viewer');
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-rotating controls setting
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // FDI lists builder
  const adultTypes = [
    'central_incisor', 'lateral_incisor', 'canine',
    'first_premolar', 'second_premolar',
    'first_molar', 'second_molar', 'third_molar'
  ];
  const pedoTypes = [
    'central_incisor', 'lateral_incisor', 'canine',
    'first_molar', 'second_molar'
  ];

  const types = isPediatric ? pedoTypes : adultTypes;
  const perSide = types.length;

  const currentToothInfo = selectedFdi ? {
    fdi: selectedFdi,
    name: TOOTH_NAMES[getToothTypeByFdi(selectedFdi)] || 'Tooth',
    isUpper: isFdiUpper(selectedFdi),
    state: toothState[selectedFdi] || 'healthy',
    desc: TOOTH_DESC[getToothTypeByFdi(selectedFdi)] || 'Standard anatomical unit of the dentition.'
  } : null;

  function isFdiUpper(fdi: number) {
    if (isPediatric) {
      return (fdi >= 51 && fdi <= 55) || (fdi >= 61 && fdi <= 65);
    }
    return (fdi >= 11 && fdi <= 18) || (fdi >= 21 && fdi <= 28);
  }

  function getToothTypeByFdi(fdi: number): string {
    const list = isPediatric ? pedoTypes : adultTypes;
    
    // Adult Upper Right (11 - 18)
    if (fdi >= 11 && fdi <= 18) return list[18 - fdi];
    // Adult Upper Left (21 - 28)
    if (fdi >= 21 && fdi <= 28) return list[fdi - 21];
    // Adult Lower Left (31 - 38)
    if (fdi >= 31 && fdi <= 38) return list[fdi - 31];
    // Adult Lower Right (41 - 48)
    if (fdi >= 41 && fdi <= 48) return list[48 - fdi];

    // Pediatric Upper Right (51 - 55)
    if (fdi >= 51 && fdi <= 55) return list[55 - fdi];
    // Pediatric Upper Left (61 - 65)
    if (fdi >= 61 && fdi <= 65) return list[fdi - 61];
    // Pediatric Lower Left (71 - 75)
    if (fdi >= 71 && fdi <= 75) return list[fdi - 71];
    // Pediatric Lower Right (81 - 85)
    if (fdi >= 81 && fdi <= 85) return list[85 - fdi];

    return 'central_incisor';
  }

  // ============================================================
  // THREE.JS IMPLEMENTATION
  // ============================================================
  function createCustomToothGeometry(type: string): THREE.BufferGeometry {
    const detail = 4; // High-resolution clinical detailing
    const geo = new THREE.IcosahedronGeometry(0.28, detail);
    const pos = geo.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      
      switch(type) {
        case 'central_incisor':
        case 'lateral_incisor': {
          // Incisors: Chisel-shaped crown, thin flat incisal edge in Z, wider mesio-distally in X
          const scaleFactor = type === 'central_incisor' ? 1.0 : 0.85;
          x *= 1.12 * scaleFactor;
          
          if (y > 0.0) {
            // Flatten facio-lingually (z) as we move toward the incisal edge
            z *= Math.max(0.08, 1.0 - (y / 0.28) * 0.88);
            // Splay wide and taper sides slightly at extreme corners
            x *= (1.0 + (y / 0.28) * 0.2);
            if (y > 0.22) {
              const cornerTaper = 1.0 - (Math.abs(x) * 0.3);
              y *= cornerTaper;
            }
          } else {
            // Cingulum (lingual convex bulge at the base of the crown, z < 0)
            if (z < 0) {
              z -= Math.sin((y + 0.15) * Math.PI) * 0.05;
            }
            z *= 0.8;
          }
          y *= 1.25 * scaleFactor;
          break;
        }
          
        case 'canine': {
          // Canines: Single robust pointed cusp, vertical labial ridge, triangular cross section
          y *= 1.45;
          x *= 0.95;
          z *= 1.05;
          
          if (y > 0.0) {
            const taper = Math.max(0.12, 1.0 - (y / 0.38) * 0.95);
            x *= taper;
            z *= taper;
            // Labial vertical ridge bulge in front face
            if (z > 0.0) {
              z += Math.cos(x * 12) * 0.05 * (1.0 - y / 0.38);
            }
          } else {
            // Robust cingulum / cervix base
            z *= 1.1;
            x *= 1.05;
          }
          break;
        }
          
        case 'first_premolar':
        case 'second_premolar': {
          // Premolars: Bicuspid (two distinct peaks - buccal and lingual separated by central groove)
          const isFirst = type === 'first_premolar';
          const sizeScale = isFirst ? 0.96 : 1.02;
          x *= 0.92 * sizeScale;
          z *= 1.12 * sizeScale;
          
          if (y > 0.05) {
            // Two major cusps: Buccal (z > 0) has high peak, Lingual (z < 0) has slightly shorter rounded cusp
            const normalizedZ = z / 0.3;
            const cuspHeight = Math.pow(Math.abs(normalizedZ), 1.6) * 0.085;
            y += cuspHeight;
            
            // Central developmental fissure valley / groove (slice depression at z = 0)
            if (Math.abs(z) < 0.08) {
              y -= 0.045 * (1.0 - Math.abs(z) / 0.08);
            }
            // Marginal ridges on mesial and distal borders
            if (Math.abs(x) > 0.22) {
              y += 0.02;
            }
          } else if (y < -0.1) {
            // Rounded neck tapers mildly
            x *= 0.82;
            z *= 0.82;
          }
          break;
        }
          
        case 'first_molar':
        case 'second_molar':
        case 'third_molar': {
          // Molars: Large crown, rounded cuboidal outline, 4 distinct major cusps, deep fissures
          const scale = type === 'first_molar' ? 1.25 : type === 'second_molar' ? 1.15 : 1.02;
          x *= scale;
          z *= scale;
          y *= 0.95;
          
          // Make outline blockier (square-ish off the round icosahedron corners)
          const absX = Math.abs(x);
          const absZ = Math.abs(z);
          x += Math.sign(x) * Math.pow(absX, 3.2) * 0.12;
          z += Math.sign(z) * Math.pow(absZ, 3.2) * 0.12;
          
          if (y > 0.0) {
            // 4 Peak cusps situated at corners: MB, DB, ML, DL
            const cuspHeight = (Math.pow(absX / 0.35, 1.8) * Math.pow(absZ / 0.35, 1.8)) * 0.11;
            y += cuspHeight;
            
            // Central vertical-horizontal fissures (cross-valleys at x = 0 and z = 0)
            if (absX < 0.12 || absZ < 0.12) {
              const grooveDepth = 0.055 * (1.0 - Math.min(absX, absZ) / 0.12);
              y -= grooveDepth;
            }
            // Raised outer marginal ridges
            if (absX > 0.26 || absZ > 0.26) {
              y += 0.015;
            }
          } else if (y < -0.1) {
            // Sturdy root trunk cervical neck
            const cervicalTaper = 0.8;
            x *= cervicalTaper;
            z *= cervicalTaper;
          }
          break;
        }
      }
      
      pos.setXYZ(i, x, y, z);
    }
    
    geo.computeVertexNormals();
    return geo;
  }

  function createToothMeshGroup(type: string, isUpper: boolean): THREE.Group {
    const group = new THREE.Group();
    
    // 1. Enamel/Crown Outer Material - highly realistic translucent PBR material
    const crownMat = new THREE.MeshPhysicalMaterial({
      color: STATE_COLORS.healthy,
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transmission: 0.22, // Enamel translucence near edges
      thickness: 0.25,
      ior: 1.63,          // Dental enamel refractive index
      sheen: 0.3,
      sheenColor: new THREE.Color(0xffffff),
      sheenRoughness: 0.3,
      side: THREE.DoubleSide,
    });
    
    const toothGeo = createCustomToothGeometry(type);
    const crownMesh = new THREE.Mesh(toothGeo, crownMat);
    crownMesh.position.y = isUpper ? -0.1 : 0.1;
    group.add(crownMesh);
    
    // 2. Dentin Core (Middle Layer) for patient education cross section / transparency
    const dentinMat = new THREE.MeshStandardMaterial({
      color: 0xdec68a, // Natural yellowish dentin bone color
      roughness: 0.5,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const dentinGeo = toothGeo.clone();
    dentinGeo.scale(0.82, 0.85, 0.82);
    const dentinMesh = new THREE.Mesh(dentinGeo, dentinMat);
    dentinMesh.position.y = isUpper ? -0.1 : 0.1;
    dentinMesh.visible = false;
    group.add(dentinMesh);

    // 3. Pulp Cavity (Inner Nerve Chamber Layer)
    const pulpMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, // Rich pink-red pulp blood lines
      side: THREE.DoubleSide,
    });
    const pulpGeo = toothGeo.clone();
    pulpGeo.scale(0.5, 0.65, 0.5);
    const pulpMesh = new THREE.Mesh(pulpGeo, pulpMat);
    pulpMesh.position.y = isUpper ? -0.1 : 0.1;
    pulpMesh.visible = false;
    group.add(pulpMesh);
    
    // 4. Roots
    const rootGeo = new THREE.ConeGeometry(0.12, 0.44, 12);
    const rootMat = new THREE.MeshStandardMaterial({
      color: 0xf0e6d2, // Cream root color
      roughness: 0.6,
      metalness: 0.0,
    });
    
    const rootCount = (type === 'first_molar' || type === 'second_molar' || type === 'third_molar') ? 2 : 1;
    const rootMeshes: THREE.Mesh[] = [];
    for (let r = 0; r < rootCount; r++) {
      const root = new THREE.Mesh(rootGeo, rootMat);
      root.position.y = isUpper ? -0.45 : 0.45;
      if (rootCount === 2) {
        root.position.x = r === 0 ? -0.07 : 0.07;
        root.rotation.z = r === 0 ? 0.14 : -0.14;
      }
      if (!isUpper) root.rotation.x = Math.PI;
      group.add(root);
      rootMeshes.push(root);
    }
    
    // 5. Titanium Implant Screw (alternative to roots when state = 'implant')
    const implantGroup = new THREE.Group();
    const screwBodyGeo = new THREE.CylinderGeometry(0.09, 0.06, 0.42, 12);
    const screwMat = new THREE.MeshStandardMaterial({
      color: 0x78716c, // Dark stone grey surgical titanium
      roughness: 0.35,
      metalness: 0.85,
    });
    const screwBody = new THREE.Mesh(screwBodyGeo, screwMat);
    implantGroup.add(screwBody);
    
    // Add small rings to simulate screw threads
    const threadGeo = new THREE.TorusGeometry(0.10, 0.016, 6, 12);
    for (let th = -3; th <= 3; th++) {
      const thread = new THREE.Mesh(threadGeo, screwMat);
      thread.rotation.x = Math.PI / 2;
      thread.position.y = th * 0.055;
      implantGroup.add(thread);
    }
    implantGroup.position.y = isUpper ? -0.43 : 0.43;
    if (!isUpper) implantGroup.rotation.x = Math.PI;
    implantGroup.visible = false;
    group.add(implantGroup);
    
    // 6. X-Ray Nerve Pulpal Strand inside Root
    const nerveGeo = new THREE.CylinderGeometry(0.012, 0.024, 0.38, 8);
    const nerveMat = new THREE.MeshBasicMaterial({
      color: 0xff3399,
      transparent: true,
      opacity: 0.95,
    });
    const nerveMesh = new THREE.Mesh(nerveGeo, nerveMat);
    nerveMesh.position.y = isUpper ? -0.32 : 0.32;
    if (!isUpper) nerveMesh.rotation.x = Math.PI;
    nerveMesh.visible = false;
    group.add(nerveMesh);

    // 7. CLINICAL OVERLAY: Caries (Decay) Surface dark brown spotting
    const cariesMat = new THREE.MeshStandardMaterial({
      color: 0x221105, // Deep rotting dark brown cavity
      roughness: 0.9,
      metalness: 0.0,
    });
    const cariesSpotGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const cariesMesh = new THREE.Mesh(cariesSpotGeo, cariesMat);
    // Position caries spot inside occlusal fissures (on top of crown)
    cariesMesh.position.set(0.02, isUpper ? -0.01 : 0.21, 0.02);
    cariesMesh.scale.set(1.4, 0.4, 1.4); // flatten it into fissures
    cariesMesh.visible = false;
    group.add(cariesMesh);

    // 8. CLINICAL OVERLAY: Dynamic Gold/Amalgam Filling line overlay
    const fillingMat = new THREE.MeshStandardMaterial({
      color: 0xb1b5c0, // Silver amalgam look
      roughness: 0.22,
      metalness: 0.9,
    });
    const fillingGeo = new THREE.BoxGeometry(0.14, 0.04, 0.18);
    const fillingMesh = new THREE.Mesh(fillingGeo, fillingMat);
    fillingMesh.position.set(-0.01, isUpper ? -0.01 : 0.21, 0.01);
    fillingMesh.visible = false;
    group.add(fillingMesh);

    // 9. CLINICAL OVERLAY: Extraction Planned glowing red target overlay
    const extractionMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const extIndicatorGeo = new THREE.TorusGeometry(0.24, 0.02, 8, 24);
    const extractionIndicator = new THREE.Mesh(extIndicatorGeo, extractionMat);
    extractionIndicator.rotation.x = Math.PI / 2;
    extractionIndicator.position.y = isUpper ? 0.22 : -0.02;
    extractionIndicator.visible = false;
    group.add(extractionIndicator);

    // 10. CLINICAL OVERLAY: Orthodontic Bracket and vector corrective force arrow
    const orthoGroup = new THREE.Group();
    const bracketMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db, // silver steel bracket
      roughness: 0.18,
      metalness: 0.9,
    });
    const bracketGeo = new THREE.BoxGeometry(0.07, 0.07, 0.035);
    const bracketMesh = new THREE.Mesh(bracketGeo, bracketMat);
    bracketMesh.position.set(0, 0, 0.16); // Face of the tooth (labial)
    orthoGroup.add(bracketMesh);
    
    // Add a vibrant blue force line vector arrow pointing up/down representing movement direction
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0x0a84ff,
    });
    const arrowShaftGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.13, 6);
    const arrowHeadGeo = new THREE.ConeGeometry(0.035, 0.06, 6);
    const arrowShaft = new THREE.Mesh(arrowShaftGeo, arrowMat);
    const arrowHead = new THREE.Mesh(arrowHeadGeo, arrowMat);
    arrowShaft.position.set(0, isUpper ? -0.1 : 0.1, 0.165);
    arrowHead.position.set(0, isUpper ? -0.165 : 0.165, 0.165);
    if (!isUpper) arrowHead.rotation.x = 0;
    else arrowHead.rotation.x = Math.PI;
    orthoGroup.add(arrowShaft);
    orthoGroup.add(arrowHead);
    
    orthoGroup.position.y = isUpper ? -0.1 : 0.1;
    orthoGroup.visible = false;
    group.add(orthoGroup);
    
    group.userData = {
      fdi: null,
      type: type,
      state: 'healthy',
      originalColor: STATE_COLORS.healthy,
      isUpper: isUpper,
      name: TOOTH_NAMES[type] || 'Tooth',
      crownMesh: crownMesh,
      dentinMesh: dentinMesh,
      pulpMesh: pulpMesh,
      rootMeshes: rootMeshes,
      implantGroup: implantGroup,
      nerveMesh: nerveMesh,
      cariesMesh: cariesMesh,
      fillingMesh: fillingMesh,
      extractionIndicator: extractionIndicator,
      orthoGroup: orthoGroup,
    };
    
    return group;
  }

  function setToothStateInScene(tooth: THREE.Group, state: string, renderMode: 'realistic' | 'xray' | 'condition') {
    if (!tooth || !tooth.userData.crownMesh) return;
    tooth.userData.state = state;
    
    const crownMesh = tooth.userData.crownMesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
    const dentinMesh = tooth.userData.dentinMesh as THREE.Mesh;
    const pulpMesh = tooth.userData.pulpMesh as THREE.Mesh;
    const rootMeshes = tooth.userData.rootMeshes as THREE.Mesh[];
    const implantGroup = tooth.userData.implantGroup as THREE.Group;
    const nerveMesh = tooth.userData.nerveMesh as THREE.Mesh;
    const cariesMesh = tooth.userData.cariesMesh as THREE.Mesh;
    const fillingMesh = tooth.userData.fillingMesh as THREE.Mesh;
    const extractionIndicator = tooth.userData.extractionIndicator as THREE.Mesh;
    const orthoGroup = tooth.userData.orthoGroup as THREE.Group;
    
    const color = (STATE_COLORS as any)[state] || STATE_COLORS.healthy;

    // Reset default visibilities
    cariesMesh.visible = false;
    fillingMesh.visible = false;
    extractionIndicator.visible = false;
    if (orthoGroup) orthoGroup.visible = false;
    if (implantGroup) implantGroup.visible = false;
    nerveMesh.visible = false;
    
    // Hide entirely if missing
    if (state === 'missing') {
      crownMesh.visible = false;
      dentinMesh.visible = false;
      pulpMesh.visible = false;
      rootMeshes.forEach(r => r.visible = false);
      return;
    } else {
      crownMesh.visible = true;
      rootMeshes.forEach(r => r.visible = true);
    }
    
    // Implants hide roots, show screw + cosmetic crown
    if (state === 'implant') {
      rootMeshes.forEach(r => r.visible = false);
      if (implantGroup) implantGroup.visible = true;
    }

    // Toggle specific clinical overlay visibilities
    if (state === 'decay') {
      cariesMesh.visible = true;
    } else if (state === 'restored') {
      fillingMesh.visible = true;
    } else if (state === 'extraction') {
      extractionIndicator.visible = true;
    } else if (state === 'ortho') {
      if (orthoGroup) orthoGroup.visible = true;
    }

    // Material setup
    const crownMat = crownMesh.material;
    
    // Customize crown materials depending on crown tooth status
    if (state === 'crown') {
      // Golden Crown representation
      crownMat.color.setHex(0xdfb443);
      crownMat.metalness = 0.9;
      crownMat.roughness = 0.15;
      crownMat.transmission = 0.0;
      crownMat.clearcoat = 1.0;
    } else if (state === 'implant') {
      // White glossy cosmetic zirconia crown on top of implant
      crownMat.color.setHex(0xffffff);
      crownMat.metalness = 0.0;
      crownMat.roughness = 0.05;
      crownMat.transmission = 0.0;
    } else {
      // Restore natural ivory enamel material
      crownMat.color.setHex(color);
      crownMat.metalness = 0.0;
      crownMat.roughness = 0.12;
      crownMat.transmission = 0.22;
    }

    // Handle Patient Education / Cross Section / Transparent overlays
    // 1. Cross Section Mode (Clipping plane slicing)
    const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.05);
    
    if (isCrossSection) {
      crownMesh.material.clippingPlanes = [clipPlane];
      (dentinMesh.material as THREE.Material).clippingPlanes = [clipPlane];
      (pulpMesh.material as THREE.Material).clippingPlanes = [clipPlane];
      
      rootMeshes.forEach(r => {
        (r.material as THREE.Material).clippingPlanes = [clipPlane];
      });
      if (implantGroup) {
        implantGroup.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            ((child as THREE.Mesh).material as THREE.Material).clippingPlanes = [clipPlane];
          }
        });
      }
      
      dentinMesh.visible = true;
      pulpMesh.visible = true;
    } else {
      // Remove clipping plane
      crownMesh.material.clippingPlanes = null;
      (dentinMesh.material as THREE.Material).clippingPlanes = null;
      (pulpMesh.material as THREE.Material).clippingPlanes = null;
      rootMeshes.forEach(r => {
        (r.material as THREE.Material).clippingPlanes = null;
      });
      if (implantGroup) {
        implantGroup.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            ((child as THREE.Mesh).material as THREE.Material).clippingPlanes = null;
          }
        });
      }
      
      dentinMesh.visible = false;
      pulpMesh.visible = false;
    }

    // 2. Translucent/Glassy Tooth Mode
    if (isTransparent) {
      crownMesh.material.transparent = true;
      crownMesh.material.opacity = 0.28;
      dentinMesh.visible = true;
      pulpMesh.visible = true;
      // Make dentin glassy too to reveal pulp
      (dentinMesh.material as THREE.Material).transparent = true;
      (dentinMesh.material as THREE.Material).opacity = 0.45;
    } else if (renderMode === 'xray') {
      crownMesh.material.transparent = true;
      crownMesh.material.opacity = 0.18;
      dentinMesh.visible = true;
      pulpMesh.visible = true;
      (dentinMesh.material as THREE.Material).transparent = true;
      (dentinMesh.material as THREE.Material).opacity = 0.35;
      
      nerveMesh.visible = true;
      (nerveMesh.material as THREE.MeshBasicMaterial).color.setHex((state === 'decay' || state === 'treatment') ? 0xef4444 : 0xff3399);
    } else {
      crownMesh.material.transparent = false;
      crownMesh.material.opacity = 1.0;
      (dentinMesh.material as THREE.Material).transparent = false;
    }

    // Root structures styling
    if (renderMode === 'realistic') {
      rootMeshes.forEach((r: THREE.Mesh) => {
        const mat = r.material as THREE.MeshStandardMaterial;
        mat.wireframe = false;
        mat.transparent = isTransparent;
        if (isTransparent) {
          mat.opacity = 0.3;
        } else {
          mat.opacity = 1.0;
        }
        mat.color.setHex(0xf0e6d2);
      });
    } else if (renderMode === 'xray') {
      rootMeshes.forEach((r: THREE.Mesh) => {
        const mat = r.material as THREE.MeshStandardMaterial;
        mat.wireframe = false;
        mat.transparent = true;
        mat.opacity = 0.22;
        mat.color.setHex(0xf0e6d2);
      });
    } else if (renderMode === 'condition') {
      if (state === 'healthy') {
        crownMesh.material.wireframe = true;
        crownMesh.material.transparent = true;
        crownMesh.material.opacity = 0.08;
        crownMesh.material.color.setHex(0x334155);
        
        rootMeshes.forEach((r: THREE.Mesh) => {
          const mat = r.material as THREE.MeshStandardMaterial;
          mat.wireframe = true;
          mat.transparent = true;
          mat.opacity = 0.05;
          mat.color.setHex(0x334155);
        });
      } else {
        crownMesh.material.wireframe = false;
        crownMesh.material.transparent = false;
        crownMesh.material.opacity = 1.0;
        
        rootMeshes.forEach((r: THREE.Mesh) => {
          const mat = r.material as THREE.MeshStandardMaterial;
          mat.wireframe = false;
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.color.setHex(color);
        });
      }
    }
  }

  function buildArchSceneGroup(isUpper: boolean, isPediatric: boolean): { group: THREE.Group, teeth: THREE.Group[] } {
    const archGroup = new THREE.Group();
    const typesToBuild = isPediatric ? pedoTypes : adultTypes;
    const archRadius = isPediatric ? 1.4 : 1.7;
    const teethList: THREE.Group[] = [];
    
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < typesToBuild.length; i++) {
        const type = typesToBuild[i];
        const angleStep = isPediatric ? 0.20 : 0.16;
        const angle = (i + 0.5) * angleStep * (side === 0 ? 1 : -1);
        
        const x = Math.sin(angle) * archRadius;
        const z = Math.cos(angle) * archRadius * 0.7;
        const y = isUpper ? 0.55 : -0.55;
        
        const tooth = createToothMeshGroup(type, isUpper);
        tooth.position.set(x, y, z);
        
        tooth.rotation.y = -angle * (side === 0 ? 1 : -1);
        if (!isUpper) {
          tooth.rotation.x = Math.PI;
          tooth.rotation.z = Math.PI;
        }
        
        let fdi;
        if (isPediatric) {
          if (isUpper) {
            fdi = side === 0 ? 55 - i : 61 + i;
          } else {
            fdi = side === 0 ? 85 - i : 71 + i;
          }
        } else {
          if (isUpper) {
            fdi = side === 0 ? 18 - i : 21 + i;
          } else {
            fdi = side === 0 ? 48 - i : 31 + i;
          }
        }
        
        tooth.userData.fdi = fdi;
        
        // Initial state load
        const curState = toothState[fdi] || 'healthy';
        setToothStateInScene(tooth, curState, renderMode3D);
        
        archGroup.add(tooth);
        teethList.push(tooth);
      }
    }
    
    return { group: archGroup, teeth: teethList };
  }

  function buildMouth() {
    const scene = sceneRef.current;
    if (!scene) return;

    if (upperArchRef.current) scene.remove(upperArchRef.current);
    if (lowerArchRef.current) scene.remove(lowerArchRef.current);
    teethMeshesRef.current = [];

    const Upper = buildArchSceneGroup(true, isPediatric);
    const Lower = buildArchSceneGroup(false, isPediatric);

    upperArchRef.current = Upper.group;
    lowerArchRef.current = Lower.group;

    scene.add(Upper.group);
    scene.add(Lower.group);

    // Initial positioning
    const targetY = isExploded ? 1.1 : 0.55;
    Upper.group.position.y = targetY;
    Lower.group.position.y = -targetY;

    // View state
    if (viewMode === 'upper') {
      Upper.group.visible = true;
      Lower.group.visible = false;
    } else if (viewMode === 'lower') {
      Upper.group.visible = false;
      Lower.group.visible = true;
    } else {
      Upper.group.visible = true;
      Lower.group.visible = true;
    }

    teethMeshesRef.current = [...Upper.teeth, ...Lower.teeth];
  }

  // Set up 3D environment on mount
  useEffect(() => {
    if (!mountRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 550;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a101d, 8, 18);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.5, 7);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = false;
    renderer.localClippingEnabled = true;
    
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.5;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.8;
    controlsRef.current = controls;

    // Lighting
    const ambient = new THREE.AmbientLight(0x4a90e2, 0.45);
    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.25);
    mainLight.position.set(3, 8, 5);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x5eead4, 0.55);
    fillLight.position.set(-5, 3, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x2563eb, 0.6);
    rimLight.position.set(0, 2, -5);
    scene.add(rimLight);

    const pointLight = new THREE.PointLight(0xfbbf24, 0.35, 8);
    pointLight.position.set(0, -1, 3);
    scene.add(pointLight);

    // Grid Floor
    const floorGeo = new THREE.CircleGeometry(8, 64);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x081225, transparent: true, opacity: 0.5 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.5;
    scene.add(floor);

    const grid = new THREE.GridHelper(12, 24, 0x14b8a6, 0x1e3a5f);
    (grid.material as THREE.Material).opacity = 0.15;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = -2.49;
    scene.add(grid);

    const ringGeo = new THREE.RingGeometry(2.2, 2.4, 64);
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: 0x14b8a6, transparent: true, opacity: 0.3, 
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.48;
    scene.add(ring);
    ringRef.current = ring;

    // Build the arches inside the scene
    buildMouth();

    // Raycaster for tooth selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleContainerClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(teethMeshesRef.current, true);

      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj.parent && !obj.userData.fdi) {
          obj = obj.parent;
        }
        if (obj && obj.userData.fdi) {
          setSelectedFdi(obj.userData.fdi);
        }
      } else {
        setSelectedFdi(null);
      }
    };

    const handleContainerPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(teethMeshesRef.current, true);

      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj.parent && !obj.userData.fdi) {
          obj = obj.parent;
        }
        if (obj && obj.userData.fdi) {
          const fdi = obj.userData.fdi;
          const name = obj.userData.name;
          const state = toothState[fdi] || 'healthy';
          setHoveredTooth({ fdi, name, state });
          setTooltipPos({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
          return;
        }
      }
      setHoveredTooth(null);
    };

    renderer.domElement.addEventListener('click', handleContainerClick);
    renderer.domElement.addEventListener('pointermove', handleContainerPointerMove);

    // Animation Loop
    let animationFrameId: number;
    let frameNum = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      frameNum++;

      if (ringRef.current) {
        ringRef.current.rotation.z += 0.003;
      }

      // Smooth pulsing for selected tooth
      if (selectedFdi) {
        const found = teethMeshesRef.current.find(t => t.userData.fdi === selectedFdi);
        if (found) {
          const pulse = 1.15 + Math.sin(frameNum * 0.08) * 0.05;
          found.scale.setScalar(pulse);
        }
      }

      // Restore scale for other teeth
      teethMeshesRef.current.forEach(t => {
        if (t.userData.fdi !== selectedFdi) {
          t.scale.setScalar(1.0);
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Resize observer (guarantees responsive resizing inside react panel iframe)
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: w, height: h } = entries[0].contentRect;
      if (w === 0 || h === 0) return;
      
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    resizeObserver.observe(containerRef.current);

    // Cleanups
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.removeEventListener('click', handleContainerClick);
        rendererRef.current.domElement.removeEventListener('pointermove', handleContainerPointerMove);
        rendererRef.current.dispose();
      }
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, [isPediatric]);

  // ============================================================
  // INTERACTIONS & HELPERS
  // ============================================================
  const updateToothState = (fdi: number, state: string) => {
    setToothState(prev => ({
      ...prev,
      [fdi]: state
    }));
  };

  const cycleSelectedToothState = () => {
    if (!selectedFdi) return;
    const states = ['healthy', 'decay', 'treatment', 'restored', 'crown', 'implant', 'missing'];
    const current = toothState[selectedFdi] || 'healthy';
    const nextIndex = (states.indexOf(current) + 1) % states.length;
    const nextState = states[nextIndex];
    updateToothState(selectedFdi, nextState);
    notify('success', `Tooth ${selectedFdi} Updated`, `Marked as ${nextState.toUpperCase()}`);
  };

  const resetAllTeeth = () => {
    const resetStates: Record<number, string> = {};
    teethMeshesRef.current.forEach(t => {
      resetStates[t.userData.fdi] = 'healthy';
    });
    setToothState(resetStates);
    setSelectedFdi(null);
    notify('info', 'Clinical Chart Cleared', 'All tooth statuses returned to healthy.');
  };

  const focusCameraOnSelected = () => {
    if (!selectedFdi || !cameraRef.current || !controlsRef.current) return;
    const found = teethMeshesRef.current.find(t => t.userData.fdi === selectedFdi);
    if (!found) return;

    const targetPos = found.position.clone();
    
    // Smooth transition
    const startTarget = controlsRef.current.target.clone();
    const startPos = cameraRef.current.position.clone();
    
    // Position offset
    const endPos = targetPos.clone().add(new THREE.Vector3(0, 0.4, 2.5));

    let t = 0;
    const lerpAnimate = () => {
      t += 0.05;
      if (t > 1) t = 1;
      const ease = 1 - Math.pow(1 - t, 3);
      controlsRef.current!.target.lerpVectors(startTarget, targetPos, ease);
      cameraRef.current!.position.lerpVectors(startPos, endPos, ease);
      if (t < 1) {
        requestAnimationFrame(lerpAnimate);
      }
    };
    lerpAnimate();
  };

  const resetCameraView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const startTarget = controlsRef.current.target.clone();
    const startPos = cameraRef.current.position.clone();
    const endTarget = new THREE.Vector3(0, 0, 0);
    const endPos = new THREE.Vector3(0, 1.5, 7);
    
    let t = 0;
    const lerpAnimate = () => {
      t += 0.05;
      if (t > 1) t = 1;
      const ease = 1 - Math.pow(1 - t, 3);
      controlsRef.current!.target.lerpVectors(startTarget, endTarget, ease);
      cameraRef.current!.position.lerpVectors(startPos, endPos, ease);
      if (t < 1) {
        requestAnimationFrame(lerpAnimate);
      }
    };
    lerpAnimate();
  };

  // Cost calculations
  const toggleProcedurePlan = (id: string) => {
    setProcedures(prev => prev.map(p => p.id === id ? { ...p, included: !p.included } : p));
  };

  const activeProcedures = procedures.filter(p => p.included);
  const totalCostTreatment = activeProcedures.reduce((sum, p) => sum + p.cost, 0);
  const totalCostLab = activeProcedures.reduce((sum, p) => sum + p.lab, 0);
  const totalCostMaterial = activeProcedures.reduce((sum, p) => sum + p.material, 0);
  const totalSubtotal = totalCostTreatment + totalCostLab + totalCostMaterial + 120; // 120 consultation
  const totalTax = totalSubtotal * 0.08;
  const totalInsurance = totalSubtotal * 0.35;
  const grandTotalEstimate = totalSubtotal + totalTax - totalInsurance;
  const monthlyFinanceEstimate = grandTotalEstimate / 12;

  // Timeline playback simulation inside details
  const startTimelinePlayback = () => {
    if (isPlayingTimeline) return;
    setIsPlayingTimeline(true);
    setTimelineProgress(0);

    const interval = setInterval(() => {
      setTimelineProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsPlayingTimeline(false);
          notify('success', 'Procedural Simulation', 'Complete 3D visual simulation sequence finished.');
          return 100;
        }
        return prev + 2;
      });
    }, 45);
  };

  // Before/after reveal interaction
  const handleBaPointerMove = (e: React.PointerEvent) => {
    if (!baContainerRef.current) return;
    const bcr = baContainerRef.current.getBoundingClientRect();
    let computedPercent = ((e.clientX - bcr.left) / bcr.width) * 100;
    computedPercent = Math.max(0, Math.min(100, computedPercent));
    setBaSliderPercent(computedPercent);
  };

  // Export report notifications
  const handleExportPlan = (type: string) => {
    notify('info', 'Export Initiated', `Generating HIPAA-Compliant Dental ${type} handout PDF...`);
    setTimeout(() => {
      notify('success', 'Export Complete', `Your ${type} has been successfully saved to downloads.`);
    }, 1500);
  };

  // Legend counts
  const totalTeethCount = teethMeshesRef.current.length || (isPediatric ? 20 : 32);
  const totalDecayCount = Object.values(toothState).filter(s => s === 'decay').length;
  const totalInTreatment = Object.values(toothState).filter(s => s === 'treatment').length;
  const totalRestoredCount = Object.values(toothState).filter(s => s === 'restored' || s === 'crown').length;

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800 dark:text-slate-100" id="dental-3d-model-explorer">
      {/* ===== ACTIVE SCROLL-SPY STICKY NAVIGATION ===== */}
      <div className="sticky top-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-40 border-b border-slate-100 dark:border-slate-900 py-3 -mx-6 px-6 mb-4 flex items-center justify-between shadow-xs transition-all">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 pr-4 scrollbar-none">
          {[
            { id: 'section-viewer', label: 'Interactive Viewer', icon: Eye },
            { id: 'section-chart', label: 'Diagnostic Chart', icon: Activity },
            { id: 'section-prognosis', label: 'Aesthetic Prognosis', icon: Sparkles },
            { id: 'section-compliance', label: 'Educational Handouts', icon: BookOpen },
          ].map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  const el = document.getElementById(sec.id);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setActiveSection(sec.id);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all ${
                  active 
                    ? 'bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {sec.label}
              </button>
            );
          })}
        </div>
        
        {/* Guided Tour Link */}
        <button
          onClick={() => {
            setTourStep(0);
            notify('success', 'Guided Tour Started', 'Welcome! We will walk you through the key clinical tools.');
            const el = document.getElementById('section-viewer');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md cursor-pointer transition-colors whitespace-nowrap"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Start Tour</span>
        </button>
      </div>

      {/* ===== HEADER ROW ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm tracking-wider uppercase">
            <Sparkles className="w-4 h-4 animate-pulse" />
            3D Clinical Education Suite
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            DentalVision 3D Explorer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time interactive anatomical model for patient consultation and treatment planning.
          </p>
        </div>

        {/* Dentition Selector */}
        <div className="flex items-center gap-3">
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-750">
            <button 
              onClick={() => {
                setIsPediatric(false);
                notify('info', 'Adult Dentition', 'Switched to full 32-teeth adult dentition model.');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${!isPediatric ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Adult (32 Teeth)
            </button>
            <button 
              onClick={() => {
                setIsPediatric(true);
                notify('info', 'Pediatric Dentition', 'Switched to temporary 20-teeth kids dentition model.');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${isPediatric ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Pediatric (20 Primary)
            </button>
          </div>

          <button 
            onClick={() => handleExportPlan('Treatment Handout')}
            className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Export Treatment Plan
          </button>
        </div>
      </div>

      {/* ===== MAIN EXPLAINER STATS ROW ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">
            {totalTeethCount}
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalTeethCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Teeth Visible</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-805/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalDecayCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Decay Spots Found</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-805/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            {totalInTreatment}
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalInTreatment}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">In Treatment Plan</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-805/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            {totalRestoredCount}
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalRestoredCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Restored & Crowned</div>
          </div>
        </div>
      </div>

      {/* ===== 3D CANVAS & EXPLORER PANEL CONTROLLER ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="section-viewer">
        
        {/* Left Column - 3D scene stage (lg:col-span-8) */}
        <div ref={containerRef} className="lg:col-span-8 bg-slate-950 hover:border-slate-850 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden relative shadow-md transition-all flex flex-col" style={{ minHeight: '520px' }}>
          
          {/* Header toolbar overlay */}
          <div className="absolute top-4 left-4 right-4 z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pointer-events-none">
            {/* View angle controllers */}
            <div className="flex flex-wrap items-center bg-slate-900/80 backdrop-blur border border-white/5 p-1 rounded-xl pointer-events-auto shadow-lg gap-0.5">
              <button 
                onClick={() => {
                  setViewMode('both');
                  notify('info', 'View: Full Mouth', 'Showing both upper and lower dental arches.');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${viewMode === 'both' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                title="View Full Mouth"
              >
                Full Mouth
              </button>
              <button 
                onClick={() => {
                  setViewMode('upper');
                  notify('info', 'View: Upper Arch', 'Isolating the upper maxillary arch.');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${viewMode === 'upper' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                title="Isolate Upper Arch"
              >
                Upper
              </button>
              <button 
                onClick={() => {
                  setViewMode('lower');
                  notify('info', 'View: Lower Arch', 'Isolating the lower mandibular arch.');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${viewMode === 'lower' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                title="Isolate Lower Arch"
              >
                Lower
              </button>
              <button 
                onClick={() => {
                  setViewMode('right');
                  notify('info', 'View: Patient Right Side', 'Isolating the patient\'s right quadrants (FDI Quadrants 1 & 4).');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${viewMode === 'right' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                title="Isolate Patient's Right Side (Quadrants 1 & 4)"
              >
                Pt. Right
              </button>
              <button 
                onClick={() => {
                  setViewMode('left');
                  notify('info', 'View: Patient Left Side', 'Isolating the patient\'s left quadrants (FDI Quadrants 2 & 3).');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${viewMode === 'left' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                title="Isolate Patient's Left Side (Quadrants 2 & 3)"
              >
                Pt. Left
              </button>
              <button 
                onClick={() => {
                  setViewMode('anterior');
                  notify('info', 'View: Anterior Teeth', 'Isolating front incisors and canines.');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${viewMode === 'anterior' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                title="Isolate Front Anterior Teeth"
              >
                Anterior
              </button>
              {selectedFdi && (
                <button 
                  onClick={() => {
                    setViewMode('focus');
                    notify('info', 'View: Single Tooth Focus', `Isolating selected tooth FDI ${selectedFdi}.`);
                  }}
                  className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-0.5 ${viewMode === 'focus' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20'}`}
                  title="Isolate Selected Tooth"
                >
                  <Focus className="w-3 h-3 text-current" />
                  <span>Focus ({selectedFdi})</span>
                </button>
              )}
            </div>

            {/* View Mode Controllers (Realistic / X-Ray / Condition Map) */}
            <div id="tour-view-modes" className="flex bg-slate-900/85 backdrop-blur border border-white/10 p-1 rounded-xl pointer-events-auto shadow-lg items-center gap-1">
              {[
                { mode: 'realistic', label: 'Realistic', icon: Eye },
                { mode: 'xray', label: 'X-Ray', icon: Layers },
                { mode: 'condition', label: 'Condition Map', icon: Activity },
              ].map((item) => {
                const Icon = item.icon;
                const active = renderMode3D === item.mode;
                return (
                  <button
                    key={item.mode}
                    onClick={() => {
                      setRenderMode3D(item.mode as any);
                      notify('success', `Mode: ${item.label}`, `3D Viewer updated to ${item.label} styling.`);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                      active 
                        ? 'bg-rose-500 text-white shadow-xs' 
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3 h-3 text-white" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick interactive parameters */}
            <div className="flex bg-slate-900/80 backdrop-blur border border-white/5 p-1 rounded-xl pointer-events-auto shadow-lg items-center gap-1">
              <button 
                onClick={() => {
                  setIsExploded(!isExploded);
                  notify('info', isExploded ? 'Arches Aligned' : 'Arches Exploded', isExploded ? 'Mouth returned to occlusion.' : 'Arches separated for internal tooth root visualization.');
                }}
                className={`p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer ${isExploded ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : ''}`}
                title="Toggle Exploded Mode"
              >
                <Compass className="w-4 h-4" />
              </button>
              
              <button 
                onClick={() => {
                  setAutoRotate(!autoRotate);
                  notify('info', autoRotate ? 'Auto Rotation Disabled' : 'Auto Rotation Active', 'Camera will orbit around the dentition model.');
                }}
                className={`p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer ${autoRotate ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : ''}`}
                title="Toggle Auto Rotation Mode"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button 
                onClick={() => {
                  setIsTransparent(!isTransparent);
                  notify('info', isTransparent ? 'Standard View' : 'Glassy View', isTransparent ? 'Enamel transparency returned to default.' : 'Enamel rendered translucent to expose internal structures.');
                }}
                className={`p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer ${isTransparent ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : ''}`}
                title="Toggle Translucent Mode (Clinical Enamel Glass)"
              >
                <Layers className="w-4 h-4" />
              </button>

              <button 
                onClick={() => {
                  setIsCrossSection(!isCrossSection);
                  notify('info', isCrossSection ? 'Full Anatomy' : 'Sliced Cross-Section', isCrossSection ? 'Mouth returned to full anatomical view.' : 'Anatomical clipping activated to examine interior crown layers.');
                }}
                className={`p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer ${isCrossSection ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : ''}`}
                title="Toggle Cross-Section Mode (Anatomical Slice)"
              >
                <BookOpen className="w-4 h-4" />
              </button>

              <button 
                onClick={resetCameraView}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Reset Camera Zoom Angle"
              >
                <Focus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Floating Occlusion Simulator widget (right hand side) */}
          <div id="tour-occlusion" className="absolute top-18 right-4 z-10 bg-slate-900/90 backdrop-blur border border-white/10 p-3.5 rounded-2xl pointer-events-auto shadow-xl max-w-[190px] w-full text-white flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Occlusion Sim
              </span>
              <span className="bg-indigo-650 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded text-[9px]">
                {biteOcclusion}%
              </span>
            </div>
            
            <input 
              type="range"
              min="0"
              max="100"
              value={biteOcclusion}
              onChange={(e) => setBiteOcclusion(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer bg-slate-800 h-1 rounded-lg appearance-none"
            />
            
            <div className="flex items-center justify-between text-[8px] text-slate-400">
              <span>Hinged Open</span>
              <span>Fully Closed</span>
            </div>
            <div className="text-[8.5px] bg-slate-950/40 p-1.5 rounded text-slate-400 leading-normal">
              {biteOcclusion === 100 ? (
                <span className="text-emerald-400 font-medium">Perfect Intercuspation (Occluded)</span>
              ) : biteOcclusion > 60 ? (
                <span>Functional contact plane</span>
              ) : biteOcclusion > 20 ? (
                <span>Hinged open bite state</span>
              ) : (
                <span className="text-amber-400 font-medium">Max orthodontic TMJ angle</span>
              )}
            </div>
          </div>

          {/* Floating Tooltip Label */}
          {hoveredTooth && (
            <div 
              className="absolute bg-slate-900/95 backdrop-blur border border-rose-500/30 px-3 py-2 rounded-xl text-xs shadow-2xl pointer-events-none z-30 flex flex-col gap-0.5 transition-all duration-75"
              style={{ 
                left: `${tooltipPos.x}px`, 
                top: `${tooltipPos.y}px`, 
                transform: 'translate(-50%, -120%)' 
              }}
            >
              <div className="flex items-center gap-2 justify-between">
                <span className="font-extrabold text-indigo-400 text-[10px]">FDI {hoveredTooth.fdi}</span>
                <span className={`text-[8px] uppercase px-1 rounded-xs font-semibold tracking-wider ${
                  hoveredTooth.state === 'healthy' 
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : hoveredTooth.state === 'decay' 
                    ? 'bg-rose-500/20 text-rose-300' 
                    : 'bg-indigo-505/20 text-indigo-300'
                }`}>
                  {hoveredTooth.state}
                </span>
              </div>
              <div className="font-bold text-slate-100 whitespace-nowrap text-xs">{hoveredTooth.name}</div>
              <div className="text-[8.5px] text-slate-400 flex items-center gap-1 mt-0.5">
                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-ping"></span>
                Click to explore condition
              </div>
            </div>
          )}

          {/* Three.js viewport container */}
          <div ref={mountRef} className="flex-1 w-full bg-slate-950" style={{ minHeight: '440px' }} />

          {/* Color Legend overlay */}
          <div className="absolute bottom-4 left-4 right-4 z-10 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 bg-slate-900/90 backdrop-blur border border-white/10 px-4 py-3 rounded-2xl pointer-events-auto text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white shadow-sm border border-slate-700"></span>
              Healthy
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              Active Decay
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              Restored Fill
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              Ceramic Crown
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-450"></span>
              Implant
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              In Treatment
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700"></span>
              Missing
            </div>
          </div>

          {/* Help tip overlay */}
          <div className="absolute bottom-18 left-4 text-[10px] text-slate-400 pointer-events-none hidden sm:block bg-slate-950/70 py-1 px-2.5 rounded-md backdrop-blur border border-white/5">
            💡 Left click + drag to orbit | Right click + drag to pan | Scroll to zoom
          </div>
        </div>

        {/* Right Column - Controls & Diagnostics (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Diagnostic tab navigation */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-1.5 flex gap-1 shadow-sm">
            <button 
              onClick={() => setActiveTab('explorer')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'explorer' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              Tooth Explorer
            </button>
            <button 
              onClick={() => setActiveTab('cost')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'cost' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              Treatment Cost
            </button>
            <button 
              onClick={() => setActiveTab('education')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'education' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              MD-Library
            </button>
          </div>

          {/* Tab content 1 - Tooth Explorer details */}
          {activeTab === 'explorer' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex-1 flex flex-col min-h-[440px]">
              {!currentToothInfo ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-850 flex items-center justify-center text-slate-350 mb-4 border border-dashed border-slate-200 dark:border-slate-750">
                    <Compass className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">No Tooth Selected</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] mt-2 leading-relaxed">
                    Click any tooth directly inside the 3D mouth model, or use the FDI notation chart below, to trigger clinical diagnostics.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  {/* Title & FDI */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold tracking-widest text-indigo-500 uppercase h-fit-content">
                        Anatomical Unit
                      </div>
                      <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-display font-bold text-sm px-2.5 py-1 rounded-xl">
                        FDI Notation {currentToothInfo.fdi}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                        {currentToothInfo.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Located on the <span className="font-semibold text-slate-700 dark:text-slate-300">{currentToothInfo.isUpper ? 'Upper Arch' : 'Lower Arch'}</span>
                      </p>
                    </div>

                    {/* Condition Status Alert */}
                    <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-950/20" style={{
                      borderColor: (STATE_HEX_COLORS as any)[currentToothInfo.state] + '40',
                      background: (STATE_HEX_COLORS as any)[currentToothInfo.state] + '0a'
                    }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: (STATE_HEX_COLORS as any)[currentToothInfo.state] }}></span>
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: (STATE_HEX_COLORS as any)[currentToothInfo.state] }}>
                          {currentToothInfo.state.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {currentToothInfo.state === 'healthy' && 'Tooth structure shows natural calcification. Continue checking margins twice annually.'}
                        {currentToothInfo.state === 'decay' && 'Caries activity observed. Urgent composite restoration recommended to safeguard pulp viability.'}
                        {currentToothInfo.state === 'treatment' && 'Tooth is flagged in the active clinical workflow. Schedule subsequent steps.'}
                        {currentToothInfo.state === 'restored' && 'Mesio-occlusal filling sound and stable. Margins show zero plaque retention.'}
                        {currentToothInfo.state === 'crown' && 'Prosthetic crown securely bonded. Healthy underlying bone structures.'}
                        {currentToothInfo.state === 'implant' && 'Zirconia/Titanium osteointegration perfect. Excellent surrounding soft tissue response.'}
                        {currentToothInfo.state === 'missing' && 'Tooth extracted or congenitally absent. Dental implant placeholder recommended.'}
                      </p>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">
                        Anatomical Purpose
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {currentToothInfo.desc}
                      </p>
                    </div>

                    {/* Procedural Animation Player */}
                    {(currentToothInfo.state === 'decay' || currentToothInfo.state === 'treatment') && (
                      <div className="border border-indigo-100/50 dark:border-indigo-900/30 p-3.5 rounded-2xl bg-indigo-50/20 dark:bg-indigo-950/10 space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>Visual Procedure Simulation</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{timelineProgress}%</span>
                        </div>
                        
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${timelineProgress}%` }} />
                        </div>

                        <button 
                          onClick={startTimelinePlayback}
                          disabled={isPlayingTimeline}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          {isPlayingTimeline ? 'Simulating Filling...' : 'Play Treatment Simulation'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button 
                      onClick={cycleSelectedToothState}
                      className="flex flex-col items-center justify-center py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors cursor-pointer border border-slate-200/50 dark:border-slate-750"
                    >
                      <RotateCw className="w-4 h-4 mb-1 text-indigo-500" />
                      Mark Status
                    </button>
                    <button 
                      onClick={focusCameraOnSelected}
                      className="flex flex-col items-center justify-center py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors cursor-pointer border border-slate-200/50 dark:border-slate-750"
                    >
                      <Focus className="w-4 h-4 mb-1 text-teal-500" />
                      Focus 3D
                    </button>
                    <button 
                      onClick={() => {
                        updateToothState(selectedFdi, 'healthy');
                        notify('info', `Reset Completed`, `Condition of tooth ${selectedFdi} returned to healthy.`);
                      }}
                      className="flex flex-col items-center justify-center py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors cursor-pointer border border-slate-200/50 dark:border-slate-750"
                    >
                      <Trash2 className="w-4 h-4 mb-1 text-rose-500" />
                      Reset Tooth
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab content 2 - Treatment Pricing Cost Estimator */}
          {activeTab === 'cost' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex-1 flex flex-col justify-between min-h-[440px]" id="tour-cost">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white">Procedures Estimator</h3>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Out-of-Pocket Estimate</span>
                </div>

                {/* Treatment Category Filter Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-100 dark:border-slate-800 scrollbar-none">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'restorative', label: 'Resto' },
                    { id: 'cosmetic', label: 'Cosmetic' },
                    { id: 'surgical', label: 'Surg' },
                    { id: 'preventive', label: 'Prev' },
                  ].map((tab) => {
                    const active = treatmentCategory === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setTreatmentCategory(tab.id as any)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                          active 
                            ? 'bg-indigo-600 text-white shadow-xs' 
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Procedure Quick toggler */}
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {procedures.filter(p => treatmentCategory === 'all' || p.category === treatmentCategory).map((p) => (
                    <div 
                      key={p.id}
                      onClick={() => toggleProcedurePlan(p.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${p.included ? 'bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-900/40' : 'bg-slate-50/50 dark:bg-slate-950/5 border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${p.included ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                          {p.included ? <Check className="w-4.5 h-4.5" /> : 'Plan'}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">{p.name}</div>
                          <div className="text-[10px] text-slate-500">{p.tooth} · ${p.cost}</div>
                        </div>
                      </div>
                      <span className="font-display font-bold text-xs text-indigo-600 dark:text-indigo-450">${p.cost}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estimate results block */}
              <div className="border-t border-slate-150 dark:border-slate-800 pt-4 mt-4 space-y-3.5">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Treatment Fees</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-350">${totalCostTreatment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lab & Materials</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-350">${totalCostLab + totalCostMaterial}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Consultation Fee</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-350">$120</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Insurance Coverage (35%)</span>
                    <span>-${totalInsurance.toFixed(0)}</span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-3 border-t border-dashed border-slate-100 dark:border-slate-850">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">Estimated Copay</div>
                  <div className="text-2xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-indigo-600 leading-none">
                    ${grandTotalEstimate.toFixed(2)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/20 text-[10px] text-slate-500 leading-relaxed">
                  🔒 Financing options: Interest-free payment schedules under 12 interest-free cycles is available (approx. <span className="font-bold text-slate-700 dark:text-slate-300">${monthlyFinanceEstimate.toFixed(2)}/mo</span>).
                </div>
              </div>
            </div>
          )}

          {/* Tab content 3 - Patient Medical Library info */}
          {activeTab === 'education' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex-1 flex flex-col justify-between min-h-[440px]">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white leading-snug">Patient Library</h3>
                
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/5">
                    <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Pathology</div>
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">How Cavities Form</div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Lactic acids from bacteria erode outer enamel crystal coatings. If unchecked, it attacks internal dentin tubules causing sensitive nerve responses.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/5">
                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Surgical</div>
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">Titanium Implant Placement</div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      A biocompatible surgical root anchors firmly to the jawbone. After osteointegration, a final abutment cap secures the ceramic prosthetic crown.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/5">
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Endodontics</div>
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">Understanding Root Canal Therapy</div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Clears infected nerve fibers out of the pulpal root channels. Backfilled with gutta-percha sealant to protect structure.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl border bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-100/50 dark:border-indigo-900/30 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                <Info className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <span>HIPAA guidelines compliant instructional text and charts for clinical rooms.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== FDI INTERACTIVE SYNC DENTAL CHART ===== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm" id="section-chart">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">FDI Linear Dental Chart</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any tooth unit inside the clinical chart to automatically zoom/select inside the 3D model above.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400 mr-2">Quick actions:</span>
            <button 
              onClick={() => {
                if (selectedFdi) {
                  updateToothState(selectedFdi, 'decay');
                  notify('info', `Tooth Marked`, `Tooth ${selectedFdi} marked as ACTIVE DECAY.`);
                } else {
                  notify('error', 'Selection Required', 'Please select a tooth before marking.');
                }
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-rose-200 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-450 cursor-pointer transition-colors"
            >
              Add Decay
            </button>
            <button 
              onClick={() => {
                if (selectedFdi) {
                  updateToothState(selectedFdi, 'crown');
                  notify('info', `Tooth Marked`, `Tooth ${selectedFdi} marked with Crown.`);
                } else {
                  notify('error', 'Selection Required', 'Please select a tooth before marking.');
                }
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-amber-200 hover:bg-amber-50 dark:border-amber-900/40 dark:hover:bg-amber-950/20 text-amber-600 dark:text-amber-450 cursor-pointer transition-colors"
            >
              Add Crown
            </button>
            <button 
              onClick={resetAllTeeth}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition-all"
            >
              Clear All statuses
            </button>
          </div>
        </div>

        {/* Dynamic FDI notations representation map */}
        <div className="overflow-x-auto py-4 border-y border-slate-50 dark:border-slate-850/60">
          <div className="min-w-[700px] flex flex-col gap-6 select-none justify-center">
            
            {/* Upper Quadrants */}
            <div className="flex justify-between px-6">
              {/* Q1: Upper Right */}
              <div className="flex gap-2">
                <span className="text-[10px] font-bold text-slate-400 capitalize self-center mr-1">Q1: Upper Right</span>
                {Array.from({ length: isPediatric ? 5 : 8 }).map((_, idx) => {
                  const fdi = isPediatric ? (55 - idx) : (18 - idx);
                  const isCurSelected = selectedFdi === fdi;
                  const curState = toothState[fdi] || 'healthy';
                  return (
                    <button 
                      key={fdi}
                      onClick={() => setSelectedFdi(fdi)}
                      className={`w-10 h-14 rounded-2xl border flex flex-col justify-between p-2 cursor-pointer transition-all ${isCurSelected ? 'border-indigo-600 dark:border-indigo-400 scale-110 ring-2 ring-indigo-100 dark:ring-indigo-950 shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:border-slate-450'}`}
                      style={{
                        background: (STATE_HEX_COLORS as any)[curState] + '1e'
                      }}
                      title={`FDI ${fdi} - ${curState}`}
                    >
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter leading-none self-center">FDI</span>
                      <span className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-200 self-center">{fdi}</span>
                      <span className="w-1.5 h-1.5 rounded-full self-center" style={{ backgroundColor: (STATE_HEX_COLORS as any)[curState] }} />
                    </button>
                  );
                })}
              </div>

              {/* Midline Divider */}
              <div className="w-px bg-slate-300 dark:bg-slate-750 h-16 self-center relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-slate-400 font-bold">Midline</div>
              </div>

              {/* Q2: Upper Left */}
              <div className="flex gap-2">
                {Array.from({ length: isPediatric ? 5 : 8 }).map((_, idx) => {
                  const fdi = isPediatric ? (61 + idx) : (21 + idx);
                  const isCurSelected = selectedFdi === fdi;
                  const curState = toothState[fdi] || 'healthy';
                  return (
                    <button 
                      key={fdi}
                      onClick={() => setSelectedFdi(fdi)}
                      className={`w-10 h-14 rounded-2xl border flex flex-col justify-between p-2 cursor-pointer transition-all ${isCurSelected ? 'border-indigo-600 dark:border-indigo-400 scale-110 ring-2 ring-indigo-100 dark:ring-indigo-950 shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:border-slate-450'}`}
                      style={{
                        background: (STATE_HEX_COLORS as any)[curState] + '1e'
                      }}
                      title={`FDI ${fdi} - ${curState}`}
                    >
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter leading-none self-center">FDI</span>
                      <span className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-200 self-center">{fdi}</span>
                      <span className="w-1.5 h-1.5 rounded-full self-center" style={{ backgroundColor: (STATE_HEX_COLORS as any)[curState] }} />
                    </button>
                  );
                })}
                <span className="text-[10px] font-bold text-slate-400 capitalize self-center ml-1">Q2: Upper Left</span>
              </div>
            </div>

            {/* Lower Quadrants */}
            <div className="flex justify-between px-6">
              {/* Q4: Lower Right */}
              <div className="flex gap-2">
                <span className="text-[10px] font-bold text-slate-400 capitalize self-center mr-1">Q4: Lower Right</span>
                {Array.from({ length: isPediatric ? 5 : 8 }).map((_, idx) => {
                  const fdi = isPediatric ? (85 - idx) : (48 - idx);
                  const isCurSelected = selectedFdi === fdi;
                  const curState = toothState[fdi] || 'healthy';
                  return (
                    <button 
                      key={fdi}
                      onClick={() => setSelectedFdi(fdi)}
                      className={`w-10 h-14 rounded-2xl border flex flex-col justify-between p-2 cursor-pointer transition-all ${isCurSelected ? 'border-indigo-600 dark:border-indigo-400 scale-110 ring-2 ring-indigo-100 dark:ring-indigo-950 shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:border-slate-450'}`}
                      style={{
                        background: (STATE_HEX_COLORS as any)[curState] + '1e'
                      }}
                      title={`FDI ${fdi} - ${curState}`}
                    >
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter leading-none self-center">FDI</span>
                      <span className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-200 self-center">{fdi}</span>
                      <span className="w-1.5 h-1.5 rounded-full self-center" style={{ backgroundColor: (STATE_HEX_COLORS as any)[curState] }} />
                    </button>
                  );
                })}
              </div>

              {/* Midline Divider lower */}
              <div className="w-px bg-slate-300 dark:bg-slate-750 h-16 self-center" />

              {/* Q3: Lower Left */}
              <div className="flex gap-2">
                {Array.from({ length: isPediatric ? 5 : 8 }).map((_, idx) => {
                  const fdi = isPediatric ? (71 + idx) : (31 + idx);
                  const isCurSelected = selectedFdi === fdi;
                  const curState = toothState[fdi] || 'healthy';
                  return (
                    <button 
                      key={fdi}
                      onClick={() => setSelectedFdi(fdi)}
                      className={`w-10 h-14 rounded-2xl border flex flex-col justify-between p-2 cursor-pointer transition-all ${isCurSelected ? 'border-indigo-600 dark:border-indigo-400 scale-110 ring-2 ring-indigo-100 dark:ring-indigo-950 shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:border-slate-450'}`}
                      style={{
                        background: (STATE_HEX_COLORS as any)[curState] + '1e'
                      }}
                      title={`FDI ${fdi} - ${curState}`}
                    >
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter leading-none self-center">FDI</span>
                      <span className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-200 self-center">{fdi}</span>
                      <span className="w-1.5 h-1.5 rounded-full self-center" style={{ backgroundColor: (STATE_HEX_COLORS as any)[curState] }} />
                    </button>
                  );
                })}
                <span className="text-[10px] font-bold text-slate-400 capitalize self-center ml-1">Q3: Lower Left</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ===== BEFORE / AFTER TRANSFORMATION COMPARISON SLIDER ===== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm" id="section-prognosis">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Esthetic Prognosis Simulation</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Drag the interactive slider below to preview treatment outcomes (multiple restorations, ceramic veneers and bleaching).
            </p>
          </div>
        </div>

        {/* Swipe Container */}
        <div 
          ref={baContainerRef}
          onPointerMove={handleBaPointerMove}
          className="relative aspect-video max-w-3xl mx-auto rounded-3xl overflow-hidden cursor-ew-resize border border-slate-200 dark:border-slate-800 select-none shadow-md"
          style={{ minHeight: '300px' }}
        >
          {/* Before view */}
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
            <div className="text-center space-y-4">
              <span className="bg-rose-500/20 text-rose-300 text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider border border-rose-500/30">
                Patient Baseline Conditions
              </span>
              <div className="text-4xl">🦷 🦷 🦷 🦷</div>
              <p className="text-xs text-slate-400">Enamel stains, active decay on lines 16 & 23, and spacing diastemas.</p>
            </div>
            <div className="absolute top-4 left-4 text-xs font-black text-white bg-black/60 px-3 py-1.5 rounded-lg border border-white/5 uppercase">
              Before
            </div>
          </div>

          {/* After view (Clipped) */}
          <div 
            className="absolute inset-0 bg-indigo-950 flex items-center justify-center transition-all bg-gradient-to-br from-indigo-950 to-slate-950"
            style={{ clipPath: `inset(0 0 0 ${baSliderPercent}%)` }}
          >
            <div className="text-center space-y-4 min-w-[300px]">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider border border-emerald-500/30">
                Completed Full Smile Reconstruction Plan
              </span>
              <div className="text-4xl">✨🦷✨🦷✨🦷 ✨</div>
              <p className="text-xs text-indigo-200">Diastema closure complete, porcelain ceramic veneers, and crown finalizations.</p>
            </div>
            <div className="absolute top-4 right-4 text-xs font-black text-white bg-indigo-600 px-3 py-1.5 rounded-lg border border-white/15 uppercase">
              After Treatment
            </div>
          </div>

          {/* Vertical Slider Handle line */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-white pointer-events-none shadow-xl z-25 flex items-center justify-center"
            style={{ left: `${baSliderPercent}%` }}
          >
            <div className="w-8 h-8 rounded-full bg-white text-indigo-600 border border-indigo-200 flex items-center justify-center text-xs font-black select-none pointer-events-none shadow-lg">
              ↔
            </div>
          </div>
        </div>
      </div>

      {/* ===== PRINT HANDOUTS HIPPA SECTION ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="section-compliance">
        
        {/* Compliance Block */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white">HIPAA Secure Consult</h4>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              This station conforms to medical safety protocols. Private clinical recordings of patient mouth dental records are locked locally and synced over private, authenticated, secure channels.
            </p>
          </div>
        </div>

        {/* Quick printable handouts block */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Check className="w-6 h-6 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white">Printable Patient Handout</h4>
            <p className="text-xs leading-relaxed text-slate-500 lg:max-w-xs dark:text-slate-400">
              Export high-resolution clinical snapshots and annotated charts alongside structured copies to present.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={() => handleExportPlan('Clinical Snapshot Report')}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-305 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
              >
                <Image className="w-3.5 h-3.5" />
                Snapshot PDF
              </button>
              <button 
                onClick={() => handleExportPlan('Comprehensive Cost Breakdown sheet')}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-305 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Cost Spreadsheet
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ===== INTERACTIVE WALKTHROUGH TOUR COMPONENT ===== */}
      <AnimatePresence>
        {tourStep !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            className="fixed bottom-6 right-6 max-w-sm w-full bg-slate-900 border border-indigo-500/30 text-white p-5 rounded-2xl shadow-2xl z-50 flex flex-col gap-4 backdrop-blur-md bg-opacity-95 pointer-events-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </span>
                <h4 className="font-bold text-xs text-indigo-300">
                  {tourSegments[tourStep].title}
                </h4>
              </div>
              <button 
                onClick={() => setTourStep(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {tourSegments[tourStep].text}
            </p>
            
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-850">
              <button
                onClick={() => setTourStep(null)}
                className="text-[10px] text-slate-400 hover:text-white transition-colors"
              >
                Skip Tour
              </button>
              
              <div className="flex items-center gap-1.5">
                <button
                  disabled={tourStep === 0}
                  onClick={() => {
                    const prevStep = tourStep - 1;
                    setTourStep(prevStep);
                    const elId = tourSegments[prevStep].selector;
                    const el = document.getElementById(elId);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-[10px] font-semibold transition-colors text-slate-200"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>
                
                <button
                  onClick={() => {
                    if (tourStep === tourSegments.length - 1) {
                      setTourStep(null);
                      notify('success', 'Tour Completed', 'You are ready to explore. Select any tooth to begin custom clinical diagnoses!');
                    } else {
                      const nextStep = tourStep + 1;
                      setTourStep(nextStep);
                      const elId = tourSegments[nextStep].selector;
                      const el = document.getElementById(elId);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-[10px] font-semibold transition-colors text-white shadow-md shadow-indigo-900/30"
                >
                  {tourStep === tourSegments.length - 1 ? 'Finish' : 'Next'} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
