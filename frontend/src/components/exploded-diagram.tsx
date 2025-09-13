"use client"

import { useRef, useEffect, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Text, Box, Sphere, Cylinder, Plane } from "@react-three/drei"
import { motion } from "framer-motion"
import * as THREE from "three"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Play, Pause, RotateCcw, ZoomIn, Activity, ChevronDown } from "lucide-react"

interface ComponentProps {
  position: [number, number, number]
  exploded: boolean
  explodedPosition: [number, number, number]
  rotation?: [number, number, number]
  explodedRotation?: [number, number, number]
  scale?: number
  color?: string
  children?: React.ReactNode
}

interface ComponentPropsWithProgress {
  position: [number, number, number]
  explosionProgress: number
  explodedPosition: [number, number, number]
  rotation?: [number, number, number]
  explodedRotation?: [number, number, number]
  scale?: number
  color?: string
  children?: React.ReactNode
}

function AnimatedComponent({ 
  position, 
  explosionProgress, 
  explodedPosition, 
  rotation = [0, 0, 0],
  explodedRotation = [0, 0, 0],
  scale = 1,
  color = "#7c3aed",
  children 
}: ComponentPropsWithProgress) {
  const meshRef = useRef<THREE.Group>(null)
  
  useFrame(() => {
    if (!meshRef.current) return
    
    // Interpolate between assembled and exploded positions based on progress
    const currentPos = [
      THREE.MathUtils.lerp(position[0], explodedPosition[0], explosionProgress),
      THREE.MathUtils.lerp(position[1], explodedPosition[1], explosionProgress),
      THREE.MathUtils.lerp(position[2], explodedPosition[2], explosionProgress)
    ]
    
    const currentRot = [
      THREE.MathUtils.lerp(rotation[0], explodedRotation[0], explosionProgress),
      THREE.MathUtils.lerp(rotation[1], explodedRotation[1], explosionProgress),
      THREE.MathUtils.lerp(rotation[2], explodedRotation[2], explosionProgress)
    ]
    
    meshRef.current.position.lerp(new THREE.Vector3(...currentPos), 0.1)
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, currentRot[0], 0.1)
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, currentRot[1], 0.1)
    meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, currentRot[2], 0.1)
  })

  return (
    <group ref={meshRef} scale={scale}>
      {children}
    </group>
  )
}

function ESP32Component({ explosionProgress }: { explosionProgress: number }) {
  return (
    <AnimatedComponent
      position={[-4, 0, 0]}
      explosionProgress={explosionProgress}
      explodedPosition={[-8, 2, -2]}
      explodedRotation={[0.3, -0.5, 0.2]}
      color="#10b981"
    >
      {/* PCB Base */}
      <Box args={[2, 0.1, 1.2]} position={[0, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial 
          color="#1f2937" 
          metalness={0.1} 
          roughness={0.8}
          envMapIntensity={0.5}
        />
      </Box>
      
      {/* ESP32 Chip */}
      <AnimatedComponent
        position={[0, 0.2, 0]}
        explosionProgress={explosionProgress}
        explodedPosition={[0, 1.5, 0]}
        explodedRotation={[0, 0.5, 0]}
      >
        <Box args={[0.8, 0.2, 0.6]} castShadow>
          <meshStandardMaterial 
            color="#374151" 
            metalness={0.9} 
            roughness={0.1}
            envMapIntensity={1}
          />
        </Box>
      </AnimatedComponent>
      
      {/* GPIO Pins */}
      {Array.from({ length: 8 }, (_, i) => (
        <AnimatedComponent
          key={i}
          position={[-0.8 + (i * 0.2), -0.15, 0.7]}
          explosionProgress={explosionProgress}
          explodedPosition={[-0.8 + (i * 0.2), -0.8, 1.2]}
        >
          <Cylinder args={[0.02, 0.02, 0.3]}>
            <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
          </Cylinder>
        </AnimatedComponent>
      ))}
      
      {/* Power LED */}
      <AnimatedComponent
        position={[0.6, 0.15, 0.4]}
        explosionProgress={explosionProgress}
        explodedPosition={[1.2, 0.8, 0.8]}
      >
        <Sphere args={[0.05]}>
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
        </Sphere>
      </AnimatedComponent>
      
      {/* WiFi Antenna */}
      <AnimatedComponent
        position={[0.8, 0.3, 0]}
        explosionProgress={explosionProgress}
        explodedPosition={[1.8, 1.2, 0]}
        explodedRotation={[0, 0, 0.5]}
      >
        <Box args={[0.1, 0.6, 0.02]}>
          <meshStandardMaterial color="#6b7280" />
        </Box>
      </AnimatedComponent>
      
      <Text
        position={[0, -0.8, 0]}
        fontSize={0.3}
        color="#10b981"
        anchorX="center"
        anchorY="middle"
      >
        ESP32
      </Text>
    </AnimatedComponent>
  )
}

function TransmissionLine({ explosionProgress, position, label }: { explosionProgress: number, position: [number, number, number], label: string }) {
  return (
    <AnimatedComponent
      position={position}
      explosionProgress={explosionProgress}
      explodedPosition={[position[0], position[1] + (position[1] > 0 ? 2 : -2), position[2]]}
      explodedRotation={[0, 0, position[1] > 0 ? 0.3 : -0.3]}
    >
      {/* Wire Core */}
      <Cylinder args={[0.05, 0.05, 3]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
      </Cylinder>
      
      {/* Insulation */}
      <AnimatedComponent
        position={[0, 0, 0]}
        explosionProgress={explosionProgress}
        explodedPosition={[0, 0.5, 0]}
      >
        <Cylinder args={[0.08, 0.08, 3]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#1f2937" transparent opacity={0.7} />
        </Cylinder>
      </AnimatedComponent>
      
      {/* Resistor Element */}
      <AnimatedComponent
        position={[0, 0, 0]}
        explosionProgress={explosionProgress}
        explodedPosition={[0, -0.8, 0]}
      >
        <Box args={[0.3, 0.1, 0.1]}>
          <meshStandardMaterial color="#dc2626" />
        </Box>
      </AnimatedComponent>
      
      <Text
        position={[0, -0.6, 0]}
        fontSize={0.2}
        color="#f59e0b"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </AnimatedComponent>
  )
}

function ConsumerDevice({ explosionProgress, position, type, color }: { 
  explosionProgress: number, 
  position: [number, number, number], 
  type: string,
  color: string 
}) {
  return (
    <AnimatedComponent
      position={position}
      explosionProgress={explosionProgress}
      explodedPosition={[position[0] + 4, position[1], position[2]]}
      explodedRotation={[0.2, 0.3, 0.1]}
    >
      {/* Housing */}
      <Box args={[0.8, 0.6, 0.4]}>
        <meshStandardMaterial color="#374151" />
      </Box>
      
      {/* Internal Components */}
      <AnimatedComponent
        position={[0, 0, 0]}
        explosionProgress={explosionProgress}
        explodedPosition={[1.5, 0, 0]}
      >
        {type === "LED" && (
          <>
            <Box args={[0.6, 0.1, 0.3]} position={[0, 0.1, 0]}>
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
            </Box>
            {Array.from({ length: 12 }, (_, i) => (
              <Sphere key={i} args={[0.02]} position={[-0.25 + (i * 0.05), 0.15, 0]}>
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
              </Sphere>
            ))}
          </>
        )}
        
        {type === "Motor" && (
          <>
            <Cylinder args={[0.2, 0.2, 0.4]} position={[0, 0, 0]}>
              <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.1} />
            </Cylinder>
            <Cylinder args={[0.05, 0.05, 0.6]} position={[0, 0, 0]}>
              <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
            </Cylinder>
          </>
        )}
        
        {type === "Fan" && (
          <>
            <Cylinder args={[0.25, 0.25, 0.1]} position={[0, 0, 0]}>
              <meshStandardMaterial color="#6b7280" />
            </Cylinder>
            {Array.from({ length: 6 }, (_, i) => (
              <Box 
                key={i} 
                args={[0.4, 0.05, 0.02]} 
                position={[0, 0, 0.06]}
                rotation={[0, 0, (i * Math.PI) / 3]}
              >
                <meshStandardMaterial color="#e5e7eb" />
              </Box>
            ))}
          </>
        )}
      </AnimatedComponent>
      
      <Text
        position={[0, -0.5, 0]}
        fontSize={0.15}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {type}
      </Text>
    </AnimatedComponent>
  )
}

function IronAirBattery({ explosionProgress }: { explosionProgress: number }) {
  return (
    <AnimatedComponent
      position={[0, -3, 0]}
      explosionProgress={explosionProgress}
      explodedPosition={[0, -6, 0]}
      explodedRotation={[0.2, 0, 0]}
      scale={1.2}
    >
      {/* Battery Housing */}
      <Box args={[1.5, 1, 0.8]}>
        <meshStandardMaterial color="#1f2937" transparent opacity={0.8} />
      </Box>
      
      {/* Iron Electrode */}
      <AnimatedComponent
        position={[-0.3, 0, 0]}
        explosionProgress={explosionProgress}
        explodedPosition={[-2, 0, 0]}
      >
        <Box args={[0.2, 0.8, 0.6]}>
          <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.3} />
        </Box>
        <Text position={[0, -0.6, 0]} fontSize={0.1} color="#6b7280">Fe</Text>
      </AnimatedComponent>
      
      {/* Air Electrode */}
      <AnimatedComponent
        position={[0.3, 0, 0]}
        explosionProgress={explosionProgress}
        explodedPosition={[2, 0, 0]}
      >
        <Box args={[0.2, 0.8, 0.6]}>
          <meshStandardMaterial color="#374151" />
        </Box>
        <Text position={[0, -0.6, 0]} fontSize={0.1} color="#374151">O₂</Text>
      </AnimatedComponent>
      
      {/* Electrolyte */}
      <AnimatedComponent
        position={[0, 0, 0]}
        explosionProgress={explosionProgress}
        explodedPosition={[0, 2, 0]}
      >
        <Box args={[0.8, 0.6, 0.4]}>
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.6} />
        </Box>
        <Text position={[0, -0.4, 0]} fontSize={0.1} color="#3b82f6">KOH</Text>
      </AnimatedComponent>
      
      {/* Rust Formation (animated) */}
      {explosionProgress > 0.5 && Array.from({ length: 20 }, (_, i) => (
        <AnimatedComponent
          key={i}
          position={[0, 0, 0]}
          explosionProgress={explosionProgress}
          explodedPosition={[
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3
          ]}
        >
          <Sphere args={[0.03]}>
            <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.2} />
          </Sphere>
        </AnimatedComponent>
      ))}
      
      <Text
        position={[0, -1.2, 0]}
        fontSize={0.25}
        color="#f59e0b"
        anchorX="center"
        anchorY="middle"
      >
        Iron-Air Cell
      </Text>
    </AnimatedComponent>
  )
}

function CerebrasChip({ explosionProgress }: { explosionProgress: number }) {
  return (
    <AnimatedComponent
      position={[0, 4, 0]}
      explosionProgress={explosionProgress}
      explodedPosition={[0, 8, 0]}
      explodedRotation={[0.1, 0.2, 0]}
      scale={1.3}
    >
      {/* Wafer Base */}
      <Cylinder args={[1.2, 1.2, 0.1]}>
        <meshStandardMaterial color="#1f2937" metalness={0.9} roughness={0.1} />
      </Cylinder>
      
      {/* Processing Units */}
      {Array.from({ length: 64 }, (_, i) => {
        const angle = (i / 64) * Math.PI * 2
        const radius = 0.8
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        
        return (
          <AnimatedComponent
            key={i}
            position={[x, 0.1, z]}
            explosionProgress={explosionProgress}
            explodedPosition={[x * 2, 0.1 + (i % 8) * 0.3, z * 2]}
            explodedRotation={[0, angle, 0]}
          >
            <Box args={[0.08, 0.05, 0.08]}>
              <meshStandardMaterial 
                color="#8b5cf6" 
                emissive="#8b5cf6" 
                emissiveIntensity={0.3}
                metalness={0.7}
                roughness={0.3}
              />
            </Box>
          </AnimatedComponent>
        )
      })}
      
      {/* Central Core */}
      <AnimatedComponent
        position={[0, 0.15, 0]}
        explosionProgress={explosionProgress}
        explodedPosition={[0, 2, 0]}
      >
        <Cylinder args={[0.3, 0.3, 0.1]}>
          <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={0.5} />
        </Cylinder>
      </AnimatedComponent>
      
      <Text
        position={[0, -1, 0]}
        fontSize={0.25}
        color="#8b5cf6"
        anchorX="center"
        anchorY="middle"
      >
        Cerebras CS-2
      </Text>
    </AnimatedComponent>
  )
}

function PowerFlowLines({ explosionProgress }: { explosionProgress: number }) {
  const linesRef = useRef<THREE.Group>(null)
  
  useFrame(({ clock }) => {
    if (linesRef.current) {
      linesRef.current.children.forEach((child: THREE.Object3D, i: number) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial
          material.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 3 + i) * 0.2
        }
      })
    }
  })
  
  return (
    <group ref={linesRef}>
      {/* Power flow visualization */}
      <Cylinder 
        args={[0.02, 0.02, 3]} 
        position={[-1, 0, 0]} 
        rotation={[0, 0, Math.PI / 2]}
      >
        <meshStandardMaterial 
          color="#fbbf24" 
          emissive="#fbbf24" 
          emissiveIntensity={0.3}
          transparent
          opacity={0.4 + (explosionProgress * 0.4)}
        />
      </Cylinder>
      
      <Cylinder 
        args={[0.02, 0.02, 3]} 
        position={[1, 0, 0]} 
        rotation={[0, 0, Math.PI / 2]}
      >
        <meshStandardMaterial 
          color="#f59e0b" 
          emissive="#f59e0b" 
          emissiveIntensity={0.3}
          transparent
          opacity={0.4 + (explosionProgress * 0.4)}
        />
      </Cylinder>
    </group>
  )
}

function Scene({ explosionProgress }: { explosionProgress: number }) {
  const { camera } = useThree()
  
  useFrame(({ clock }) => {
    // Subtle camera movement for cinematic effect
    camera.position.y = 8 + Math.sin(clock.elapsedTime * 0.2) * 0.5
  })

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight 
        position={[10, 15, 10]} 
        intensity={1.2} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-8, 5, -8]} intensity={0.8} color="#8b5cf6" />
      <pointLight position={[8, -3, 8]} intensity={0.6} color="#3b82f6" />
      <spotLight 
        position={[0, 20, 0]} 
        angle={0.3} 
        penumbra={0.5} 
        intensity={0.8}
        color="#ffffff"
        castShadow
      />
      
      <ESP32Component explosionProgress={explosionProgress} />
      
      <TransmissionLine explosionProgress={explosionProgress} position={[-1, 0.5, 0]} label="Line A" />
      <TransmissionLine explosionProgress={explosionProgress} position={[1, -0.5, 0]} label="Line B" />
      
      <ConsumerDevice explosionProgress={explosionProgress} position={[4, 1, 0]} type="LED" color="#3b82f6" />
      <ConsumerDevice explosionProgress={explosionProgress} position={[4, 0, 0]} type="Motor" color="#8b5cf6" />
      <ConsumerDevice explosionProgress={explosionProgress} position={[4, -1, 0]} type="Fan" color="#ec4899" />
      
      <IronAirBattery explosionProgress={explosionProgress} />
      <CerebrasChip explosionProgress={explosionProgress} />
      
      <PowerFlowLines explosionProgress={explosionProgress} />
      
      {/* Enhanced Grid plane with reflections */}
      <Plane args={[25, 25]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.5, 0]} receiveShadow>
        <meshStandardMaterial 
          color="#0f172a" 
          metalness={0.8}
          roughness={0.2}
          transparent 
          opacity={0.3}
          envMapIntensity={0.5}
        />
      </Plane>
      
      {/* Particle effects for energy flow */}
      {explosionProgress > 0.3 && Array.from({ length: 30 }, (_, i) => (
        <AnimatedComponent
          key={`particle-${i}`}
          position={[
            (Math.random() - 0.5) * 15,
            Math.random() * 8,
            (Math.random() - 0.5) * 15
          ]}
          explosionProgress={explosionProgress}
          explodedPosition={[
            (Math.random() - 0.5) * 20,
            Math.random() * 12,
            (Math.random() - 0.5) * 20
          ]}
        >
          <Sphere args={[0.02]}>
            <meshStandardMaterial 
              color="#3b82f6" 
              emissive="#3b82f6" 
              emissiveIntensity={0.8}
              transparent
              opacity={0.6}
            />
          </Sphere>
        </AnimatedComponent>
      ))}
    </>
  )
}

export function ExplodedDiagram() {
  const [explosionProgress, setExplosionProgress] = useState(0) // 0-1 explosion progress
  const [autoRotate, setAutoRotate] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const lockPositionRef = useRef<number>(0)

  useEffect(() => {
    let isScrolling = false
    
    const handleScroll = () => {
      if (!containerRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const windowHeight = window.innerHeight
      
      // Check if we should start the explosion sequence
      const componentTop = rect.top
      const scrollTriggerPoint = windowHeight * 0.1 // Trigger when component top hits 10% from top of viewport
      
      if (componentTop < scrollTriggerPoint && !isLocked && explosionProgress === 0) {
        // Start explosion sequence - lock scroll
        setIsLocked(true)
        lockPositionRef.current = window.scrollY
        document.body.style.overflow = 'hidden'
        
        // Animate explosion over 3 seconds
        let startTime = Date.now()
        const duration = 3000
        
        const animateExplosion = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)
          
          // Eased progress for smooth explosion
          const easedProgress = 1 - Math.pow(1 - progress, 3) // Cubic ease-out
          setExplosionProgress(easedProgress)
          
          if (progress < 1) {
            requestAnimationFrame(animateExplosion)
          } else {
            // Explosion complete - unlock scroll
            setIsLocked(false)
            document.body.style.overflow = 'auto'
          }
        }
        
        requestAnimationFrame(animateExplosion)
      }
      
      // Reset if scrolled back up
      if (rect.top > 100 && explosionProgress > 0) {
        setExplosionProgress(0)
        setIsLocked(false)
        document.body.style.overflow = 'auto'
      }
    }

    const throttledScroll = () => {
      if (!isScrolling) {
        requestAnimationFrame(() => {
          handleScroll()
          isScrolling = false
        })
        isScrolling = true
      }
    }

    window.addEventListener('scroll', throttledScroll, { passive: true })
    handleScroll() // Check initial state
    
    return () => {
      window.removeEventListener('scroll', throttledScroll)
      document.body.style.overflow = 'auto' // Cleanup
    }
  }, [explosionProgress, isLocked])

  return (
    <div 
      ref={containerRef}
      className="w-full h-[800px] relative bg-gradient-to-br from-background via-muted/5 to-primary/5 rounded-3xl border-2 border-primary/20 overflow-hidden shadow-2xl"
    >
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [12, 8, 12], fov: 45 }}
        className="w-full h-full"
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        }}
      >
        <fog attach="fog" args={['#000000', 15, 35]} />
        <Scene explosionProgress={explosionProgress} />
        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          enableRotate={true}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8 - (explosionProgress * 0.5)}
          minDistance={8}
          maxDistance={25}
          enableDamping={true}
          dampingFactor={0.05}
        />
      </Canvas>
      
      {/* Minimal Status Indicator */}
      <div className="absolute top-4 left-4 z-10">
        <Card className="p-3 bg-background/95 backdrop-blur-md border border-primary/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">3D System Active</span>
          </div>
        </Card>
      </div>
      
      {/* Enhanced Info Panel */}
      <div className="absolute bottom-4 right-4 z-10">
        <Card className="p-4 bg-background/95 backdrop-blur-md border border-primary/30 max-w-xs">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="text-primary" size={16} />
              System Overview
            </CardTitle>
            <CardDescription className="text-xs">Real hardware simulation</CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Total Power</span>
                <span className="font-mono text-primary">4.8A</span>
              </div>
              <Progress value={78} className="h-1.5" />
              <div className="flex justify-between text-xs">
                <span>Grid Efficiency</span>
                <span className="font-mono text-primary">94.2%</span>
              </div>
              <Progress value={94} className="h-1.5" />
              <div className="flex justify-between text-xs">
                <span>AI Confidence</span>
                <span className="font-mono text-primary">97.8%</span>
              </div>
              <Progress value={98} className="h-1.5" />
            </div>
            
            <Separator className="my-3" />
            
            <div className="flex items-center justify-between">
              <Badge variant={explosionProgress > 0.5 ? "default" : "secondary"} className="text-xs">
                {explosionProgress > 0.5 ? "🔥 Exploded" : "🔧 Assembled"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                Live
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Scroll Hint */}
      <div className="absolute top-4 right-4 z-10">
        <Card className="p-3 bg-background/95 backdrop-blur-md border border-primary/30">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <ChevronDown className={`transition-transform ${explosionProgress > 0.5 ? 'rotate-180' : ''}`} size={14} />
            {explosionProgress > 0.5 ? 'Scroll up to collapse' : 'Scroll down to explode'}
          </p>
        </Card>
      </div>
    </div>
  )
}
