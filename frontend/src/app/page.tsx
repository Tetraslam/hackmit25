"use client"

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, Battery, Brain, ArrowRight, ChevronDown, 
  Cpu, Network, Activity, Settings, 
  TrendingUp, Shield, Globe, Lightbulb,
  Play, Pause, RotateCcw, Power
} from "lucide-react";
import { ExplodedDiagram } from "@/components/exploded-diagram";

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("overview");


  // Stats counter animation with intersection observer
  useEffect(() => {
    const statsAnimation = () => {
      const statElements = document.querySelectorAll('.stat-number');
      statElements.forEach((el) => {
        const target = parseInt(el.getAttribute('data-value') || '0');
        let current = 0;
        const increment = target / 60; // 60 frames for smooth animation
        const duration = 2000;
        const startTime = Date.now();
        
        const updateCounter = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Eased progress for smooth counting
          const easedProgress = 1 - Math.pow(1 - progress, 3);
          current = Math.floor(target * easedProgress);
          
          el.textContent = current.toString();
          
          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          } else {
            el.textContent = target.toString(); // Ensure final value is exact
          }
        };
        
        requestAnimationFrame(updateCounter);
      });
    };

    const observerOptions = { threshold: 0.3, rootMargin: '0px 0px -50px 0px' };
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          statsAnimation();
          statsObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    if (statsRef.current) statsObserver.observe(statsRef.current);
    return () => statsObserver.disconnect();
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.1),transparent)]" />
        
        <div className="container mx-auto px-4 text-left z-10 max-w-4xl">
          <div className="hero-badge animate-in fade-in slide-in-from-bottom-4 duration-800 mb-6">
            <Badge variant="secondary" className="text-sm px-4 py-2">
              HackMIT 2025 · Sustainability Track
            </Badge>
          </div>
          
          <h1 className="hero-title animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200 text-6xl md:text-8xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
            Griddy
          </h1>
          
          <p className="hero-subtitle animate-in fade-in slide-in-from-bottom-4 duration-800 delay-400 text-xl md:text-2xl text-muted-foreground mb-8 max-w-4xl mx-auto leading-relaxed">
            ESP32 microgrid optimization with MILP algorithms and Cerebras AI.
            <br />
            <span className="text-primary font-semibold">Hardware-in-the-loop power dispatch at 24Hz.</span>
          </p>
          
          <div className="hero-buttons animate-in fade-in slide-in-from-bottom-4 duration-600 delay-600 flex flex-col sm:flex-row gap-4 items-start">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/metrics">
                View Dashboard <ArrowRight className="ml-2" size={20} />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="https://formenergy.com" target="_blank" rel="noreferrer">
                Learn Iron‑Air Tech
              </Link>
            </Button>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce"
          onClick={() => document.getElementById('exploded-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <ChevronDown className="text-muted-foreground" size={24} />
        </Button>
      </section>

      {/* Interactive Exploded Diagram Section */}
      <section id="exploded-section" className="py-20 bg-muted/5">
        <div className="container mx-auto px-4">
          
          
          {/* EPIC 3D EXPLODED DIAGRAM */}
          <ExplodedDiagram />
        </div>
      </section>

      {/* Interactive Technical Showcase */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">System Architecture</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Three-layer optimization stack: ESP32 hardware telemetry, MILP scheduling with Fourier forecasting, 
              and Cerebras AI escalation for low-confidence scenarios.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Globe size={16} />
                Overview
              </TabsTrigger>
              <TabsTrigger value="algorithm" className="flex items-center gap-2">
                <Cpu size={16} />
                Algorithm
              </TabsTrigger>
              <TabsTrigger value="hardware" className="flex items-center gap-2">
                <Zap size={16} />
                Hardware
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Brain size={16} />
                AI Layer
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Economic Forcing Function</AlertTitle>
                <AlertDescription>
                  The only sustainable path to decarbonization is making renewables + storage so cheap that 
                  fossil generation becomes economically unviable. Small consumer behavior changes won't scale.
                </AlertDescription>
              </Alert>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="text-primary" size={20} />
                      Economic Forcing Function
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      US companies demand 3-5 year returns, but power infrastructure requires 10-12 year horizons. 
                      This economic mismatch systematically favors fossil fuels over renewables + storage.
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Coal generation cost</span>
                        <span className="font-mono">$0.12/kWh</span>
                      </div>
                      <Progress value={80} className="h-2" />
                      <div className="flex justify-between text-sm">
                        <span>Solar + iron-air storage</span>
                        <span className="font-mono text-green-600">$0.06/kWh</span>
                      </div>
                      <Progress value={40} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Battery className="text-primary" size={20} />
                      Supply Chain Independence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Iron-air batteries eliminate rare earth dependencies. Iron, water, and air 
                      are abundant everywhere—no Chinese supply chain bottlenecks.
                    </p>
                    <Accordion type="single" collapsible>
                      <AccordionItem value="chemistry">
                        <AccordionTrigger>Reversible Rusting Chemistry</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 text-sm">
                            <p><strong>Discharge:</strong> 4Fe + 3O₂ → 2Fe₂O₃ + energy</p>
                            <p><strong>Charge:</strong> 2Fe₂O₃ + energy → 4Fe + 3O₂</p>
                            <p className="text-muted-foreground">
                              The process is completely reversible and can cycle thousands of times 
                              with minimal degradation.
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="algorithm" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>MILP Formulation</CardTitle>
                    <CardDescription>Mixed-integer linear programming for optimal dispatch</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
{`Variables:
  x[s,n,t] ≥ 0    # amps from source s to node n at time t
  y[s,n,t] ∈ {0,1} # binary on/off assignment
  unmet[n,t] ≥ 0  # unmet demand penalty

Constraints:
  ∀n,t: Σₛ x[s,n,t] + unmet[n,t] = d_forecast[n,t]
  ∀s,t: Σₙ x[s,n,t] ≤ max_supply[s]
  ∀s,t: |Σₙ x[s,n,t] - Σₙ x[s,n,t-1]| ≤ ramp_limit[s]

Objective:
  minimize Σₛ,ₙ,ₜ cost[s] × x[s,n,t] + penalty × unmet[n,t]`}
                    </pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Fourier Forecasting</CardTitle>
                    <CardDescription>Micro-prediction for demand patterns</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                      For nodes with sufficient history, we fit 1-2 Fourier terms to capture 
                      periodic demand patterns. Otherwise, we flat-fill with the latest reading.
                    </p>
                    <Accordion type="single" collapsible>
                      <AccordionItem value="fourier">
                        <AccordionTrigger>Fourier Implementation</AccordionTrigger>
                        <AccordionContent>
                          <pre className="text-xs bg-muted p-3 rounded">
{`FOURIER_OR_FLAT(hist, latest, H):
  if len(hist) < MIN_SAMPLES:
    return [latest] * H
  
  # Detect dominant period or use fixed
  period = detect_period(hist) || FIXED_PERIOD
  
  # Fit K=1..2 Fourier terms
  a₀ = mean(hist)
  for k in 1..K:
    aₖ = 2/N × Σ hist[i] × cos(2πki/period)
    bₖ = 2/N × Σ hist[i] × sin(2πki/period)
  
  # Project forward H epochs
  forecast = []
  for t in 1..H:
    y = a₀ + Σₖ (aₖcos(2πkt/period) + bₖsin(2πkt/period))
    forecast.append(max(0, y))
  
  return forecast`}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="hardware" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="text-primary" size={20} />
                      ESP32 Controller
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>CPU Frequency</span>
                        <span className="font-mono">240 MHz</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>GPIO Pins</span>
                        <span className="font-mono">34 pins</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>WiFi</span>
                        <span className="font-mono">802.11 b/g/n</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Power Output</span>
                        <span className="font-mono">3.3V · 40mA</span>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-xs text-muted-foreground">
                      Dual-core Tensilica LX6 with integrated WiFi for real-time telemetry streaming
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="text-primary" size={20} />
                      Transmission Network
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Line A (47Ω)</span>
                          <span className="font-mono">12% loss</span>
                        </div>
                        <Progress value={88} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Line B (33Ω)</span>
                          <span className="font-mono">8% loss</span>
                        </div>
                        <Progress value={92} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Line C (22Ω)</span>
                          <span className="font-mono">5% loss</span>
                        </div>
                        <Progress value={95} className="h-2" />
                      </div>
                    </div>
                    <Separator />
                    <p className="text-xs text-muted-foreground">
                      Resistive losses simulated with precision resistors modeling real transmission physics
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="text-primary" size={20} />
                      Load Consumers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lightbulb size={16} className="text-primary" />
                          <span className="text-sm">LED Array</span>
                        </div>
                        <span className="font-mono text-sm">2.1A</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Settings size={16} className="text-primary" />
                          <span className="text-sm">DC Motor</span>
                        </div>
                        <span className="font-mono text-sm">1.8A</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity size={16} className="text-primary" />
                          <span className="text-sm">Cooling Fan</span>
                        </div>
                        <span className="font-mono text-sm">0.9A</span>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-xs text-muted-foreground">
                      Variable loads with realistic demand curves and power factor considerations
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-6">
              <Alert>
                <Brain className="h-4 w-4" />
                <AlertTitle>Cerebras CS-2 Integration</AlertTitle>
                <AlertDescription>
                  When deterministic algorithms hit uncertainty thresholds, we escalate to a 
                  wafer-scale AI with live news context—the same information advantage human operators use.
                </AlertDescription>
              </Alert>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Escalation Triggers</CardTitle>
                    <CardDescription>When do we call the AI?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>MILP infeasibility</span>
                          <Badge variant="outline">Critical</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          When demand exceeds available supply across all scenarios
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Forecast variance &gt; 25%</span>
                          <Badge variant="secondary">High</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          When Fourier predictions show high uncertainty
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>External event detected</span>
                          <Badge variant="secondary">Medium</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Live news mentions grid events, weather, or supply disruptions
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Context Streaming</CardTitle>
                    <CardDescription>What data feeds the AI</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Accordion type="multiple" className="w-full">
                      <AccordionItem value="telemetry">
                        <AccordionTrigger>Real-time Telemetry</AccordionTrigger>
                        <AccordionContent>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• Per-node demand history (last 100 epochs)</li>
                            <li>• Source capacity and ramp constraints</li>
                            <li>• Transmission line losses and impedance</li>
                            <li>• MILP solver status and dual variables</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="news">
                        <AccordionTrigger>Live News Feed</AccordionTrigger>
                        <AccordionContent>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• Grid stability reports from NERC</li>
                            <li>• Weather alerts affecting renewable generation</li>
                            <li>• Supply chain disruptions in energy sector</li>
                            <li>• Geopolitical events affecting energy markets</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="context">
                        <AccordionTrigger>System Context</AccordionTrigger>
                        <AccordionContent>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• Current system state and confidence scores</li>
                            <li>• Historical performance metrics</li>
                            <li>• Load forecasting accuracy statistics</li>
                            <li>• Previous AI recommendations and outcomes</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Technical Implementation */}
      <section ref={statsRef} className="py-20 bg-muted/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">The Problem We're Solving</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              US power infrastructure faces critical challenges: Chinese rare earth dependency, 
              short-term investment cycles, and misaligned economic incentives that favor fossil fuels.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-3 text-red-600">Supply Chain Crisis</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                80% of rare earth metals for batteries and solar panels come from China. 
                This creates strategic vulnerability for US energy independence.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-3 text-orange-600">Investment Mismatch</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                US companies demand 3-5 year returns, but power grid infrastructure 
                requires 10-12 year investment horizons. This favors fossil fuels.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-3 text-blue-600">Economic Forcing</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Making renewables + storage so cheap that fossil generation becomes 
                economically unviable is the only sustainable path forward.
              </p>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Power className="text-primary" size={20} />
                  Our Solution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Iron-air batteries store electricity by rusting and de-oxidizing iron on demand. 
                  Can handle 3+ days of community power using abundant materials.
                </p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• No rare earth metals required</li>
                  <li>• 100+ hour discharge duration</li>
                  <li>• Uses iron, water, and air only</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="text-primary" size={20} />
                  Technical Implementation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Physical ESP32 microgrid with 6 consumer loads, resistive transmission losses, 
                  and sine-wave demand modulation. Real hardware generates 24Hz telemetry.
                </p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• MILP optimization with CBC solver</li>
                  <li>• Fourier forecasting (K=1-2 terms)</li>
                  <li>• Cerebras AI (3000+ tokens/sec)</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="text-primary" size={20} />
                  Demo Architecture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Single-cell iron-air battery manually connected to demonstrate backup power 
                  when ESP32 "goes dark" to simulate grid outage.
                </p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Step-up/down transformers</li>
                  <li>• Resistive transmission losses</li>
                  <li>• 6 consumer loads (LEDs, motors, fans)</li>
                  <li>• Manual iron-air failover</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-primary-foreground mb-6">Griddy: ESP32 Microgrid Optimization</h2>
          <p className="text-xl text-primary-foreground/80 mb-8 max-w-3xl mx-auto">
            Hardware-in-the-loop demonstration of MILP power dispatch, Fourier demand forecasting, 
            and Cerebras AI escalation for low-confidence scenarios.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6" asChild>
              <Link href="/metrics">
                View Dashboard <ArrowRight className="ml-2" size={20} />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20" asChild>
              <Link href="https://formenergy.com" target="_blank" rel="noreferrer">
                Iron-Air Battery Tech
              </Link>
            </Button>
          </div>
    </div>
      </section>
    </>
  );
}
