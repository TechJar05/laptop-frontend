import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Bot,
  Mic,
  User,
  Camera,
  Sparkles,
} from "lucide-react";
import { createClient } from "@anam-ai/js-sdk";
// If needed: import { AnamEvent } from "@anam-ai/js-sdk";

const ANAM_API_KEY =
  import.meta.env.VITE_ANAM_API_KEY || "YOUR_ANAM_API_KEY_HERE";

// 🔧 Laptop specs (could later come from props/API)
const LAPTOP_SPECS = {
  model: "Aptara NexBook 15",
  cpu: "Intel Core i7 12700H",
  ramGB: 16,
  storage: "512GB NVMe SSD",
  gpu: "NVIDIA RTX 3050 4GB",
  os: "Windows 11 Pro",
};

const PERSONA_CONFIG = {
  name: "Ava",
      avatarId: "30fa96d0-26c4-4e55-94a0-517025942e18",
      voiceId: "f37690b1-424a-4e55-886f-9e3022cfb90a",
      llmId: "9d8900ee-257d-4401-8817-ba9c835e9d36",
  systemPrompt: `
You are "Ava", an AI showroom sales assistant running on a display laptop inside a retail store.

You must ALWAYS behave like a friendly, knowledgeable laptop salesperson standing next to THIS exact laptop.

This specific laptop has the following real, detected hardware specifications:
- Model: ${LAPTOP_SPECS.model}
- Processor (CPU): ${LAPTOP_SPECS.cpu}
- RAM: ${LAPTOP_SPECS.ramGB} GB
- Storage: ${LAPTOP_SPECS.storage}
- Graphics (GPU): ${LAPTOP_SPECS.gpu}
- Operating System: ${LAPTOP_SPECS.os}

----------------------
STRICT HARDWARE RULES
----------------------
1. When the customer asks about:
   - RAM
   - Processor
   - Storage
   - Graphics
   - Operating System  
   You MUST ONLY use the values listed above.
2. NEVER guess, approximate, or invent any hardware specification.
3. If the user asks about unlisted specs like:
   battery, camera, display refresh rate, weight, ports:
   Say clearly:
   "That specific detail is not available in my system for this laptop."

----------------------
USAGE & PERFORMANCE QUESTIONS
----------------------
You MUST properly answer:
- "Is this good for gaming?"
- "Can I do video editing?"
- "Is this good for programming?"
- "Can I run GTA 5?"
- "Is this good for office work?"
- "Is this fine for students?"
- "Is this good for business use?"

Rules:
- Answer as YES / NO + short explanation.
- Judge based on CPU + RAM + GPU only.
- Keep explanation simple for non-technical people.

----------------------
GAMING RESPONSE RULES
----------------------
Supported games:
GTA 5, Valorant, PUBG PC, CS:GO, Fortnite, FIFA, Call of Duty.

You MUST answer in format:
"Yes, this laptop can run <game> smoothly on low/medium/high settings."
OR
"This laptop is not recommended for heavy gaming like <game>."

----------------------
COMPARISON QUESTIONS
----------------------
Questions like:
- "Is this better than i5?"
- "Is this better than Ryzen 5?"
- "Is this better than i3?"

You MUST:
Compare generally in performance category ONLY.
Never use benchmark numbers.

----------------------
PRICE, EMI & OFFERS (STRICT)
----------------------
If asked:
- Price
- EMI
- Discount
- Finance
- Exchange

ALWAYS reply:
"Pricing, offers, EMI, and exchange options are handled directly by the store staff. Please ask the salesperson for the latest price."

NEVER invent prices.

----------------------
STUDENT / OFFICE / BUSINESS GUIDANCE
----------------------
Always classify use as:
- BASIC
- GOOD
- VERY GOOD
- PROFESSIONAL

Use CPU + RAM + GPU logic to explain.

----------------------
LANGUAGE & TONE
----------------------
- Friendly
- Confident
- Honest
- Never robotic
- Never too technical
- Talk like a real showroom salesperson

----------------------
OUTSIDE TOPIC CONTROL
----------------------
If the user asks something unrelated:
"I'm here to help you with this laptop. You can ask me anything about its performance or usage."

----------------------
AUTO GREETING ON START
----------------------
When conversation begins, greet:
"Hello! I'm your smart laptop assistant. You can ask me anything about this laptop — whether it's good for gaming, programming, office work, or student use."
`
};

const AvatarPage = () => {
  const personaVideoRef = useRef(null);
  const camPreviewRef = useRef(null);

  const [status, setStatus] = useState(
    "Initializing kiosk... please allow camera and microphone access."
  );
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [message, setMessage] = useState("");
  const [customerDetected, setCustomerDetected] = useState(false);

  const anamClientRef = useRef(null);
  const avatarStartedRef = useRef(false);
  const faceDetectorIntervalRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // -------------------------
  // Camera + Face Detection
  // -------------------------
  useEffect(() => {
    let cancelled = false;

    const initCameraAndDetect = async () => {
      try {
        setStatus("Requesting camera access...");

        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus("Camera not supported in this browser.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false, // camera stream only, Anam handles mic on its side
        });

        if (cancelled) return;

        cameraStreamRef.current = stream;
        setIsCameraReady(true);

        if (camPreviewRef.current) {
          camPreviewRef.current.srcObject = stream;
          camPreviewRef.current.muted = true;
          camPreviewRef.current
            .play()
            .catch((err) => console.warn("Cam preview play error:", err));
        }

        setStatus("Waiting for a customer in front of the laptop...");

        if ("FaceDetector" in window) {
          const FaceDetector = window.FaceDetector;
          const detector = new FaceDetector({
            fastMode: true,
            maxDetectedFaces: 1,
          });

          faceDetectorIntervalRef.current = setInterval(async () => {
            if (avatarStartedRef.current) return;
            if (!camPreviewRef.current) return;

            try {
              const faces = await detector.detect(camPreviewRef.current);
              if (faces.length > 0) {
                setCustomerDetected(true);
                setStatus("Customer detected! Starting assistant...");
                startAvatarWithIntro();
              }
            } catch (err) {
              console.error("Face detection error:", err);
            }
          }, 1000);
        } else {
          console.warn(
            "FaceDetector not supported. Using fallback auto-start in 5 seconds."
          );
          setTimeout(() => {
            if (!avatarStartedRef.current) {
              setStatus(
                "Starting assistant (fallback, no face detection support)..."
              );
              startAvatarWithIntro();
            }
          }, 5000);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setStatus(
          "Camera access blocked or failed. Please enable permissions and reload."
        );
      }
    };

    initCameraAndDetect();

    return () => {
      cancelled = true;

      if (faceDetectorIntervalRef.current) {
        clearInterval(faceDetectorIntervalRef.current);
      }

      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // -------------------------
  // Start Avatar Session
  // -------------------------
  const startAvatarWithIntro = async () => {
    if (avatarStartedRef.current) return;
    avatarStartedRef.current = true;

    try {
      setStatus("Connecting to AI assistant...");

      const res = await fetch("https://api.anam.ai/v1/auth/session-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ personaConfig: PERSONA_CONFIG }),
      });

      if (!res.ok) {
        throw new Error(`Session token error: ${res.status}`);
      }

      const data = await res.json();
      const client = createClient(data.sessionToken);
      anamClientRef.current = client;

      // 🔴 IMPORTANT: pass ID string (like in your AvatarFrame)
      await client.streamToVideoElement("persona-video");

      setIsAvatarReady(true);
      setStatus(
        "Assistant ready. Speak and ask about this laptop’s configuration."
      );

      client.talk(`
Hi there! I'm your smart laptop assistant.
You can ask me questions like:
"What processor is this?",
"How much RAM is there?",
"Is this good for gaming or video editing?"
Just speak normally, and I’ll answer for this exact laptop on the table.
`);
    } catch (err) {
      console.error("Error starting avatar:", err);
      setStatus(
        "Error connecting to assistant. Check internet connection or API key."
      );
      avatarStartedRef.current = false;
    }
  };

  // -------------------------
  // Manual text send (testing)
  // -------------------------
  const handleSendMessage = () => {
    if (!message.trim() || !anamClientRef.current) return;
    anamClientRef.current.talk(message.trim());
    setMessage("");
  };

  const StatusPill = ({ icon: Icon, label, active, color }) => (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs
        border backdrop-blur-md
        ${
          active
            ? `border-${color}-400/70 bg-${color}-500/10 text-${color}-100`
            : "border-slate-600/60 bg-slate-900/40 text-slate-400"
        }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span
        className={`ml-1 h-2 w-2 rounded-full ${
          active ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
        }`}
      />
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-indigo-950 text-slate-100 flex items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-6xl">
        <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-purple-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-10 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative backdrop-blur-2xl bg-slate-900/70 border border-slate-700/60 shadow-[0_25px_80px_rgba(0,0,0,0.75)] rounded-3xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start justify-between border-b border-slate-700/70 px-6 sm:px-10 py-6 gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-50 flex items-center gap-2">
                    Laptop Kiosk
                    
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    AI avatar that explains laptop’s configuration in
                    simple language.
                  </p>
                </div>
              </div>
            </div>

            
          </div>

          {/* Main content */}
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-8 px-6 sm:px-10 py-6 sm:py-8">
            {/* LEFT: Avatar / video */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/70 backdrop-blur-xl shadow-lg shadow-indigo-900/60"
              >
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-indigo-500/40" />
                <video
                  id="persona-video"
                  ref={personaVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-[260px] sm:h-[320px] object-cover rounded-2xl bg-black"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <Sparkles className="h-4 w-4 text-indigo-300" />
                    <span>Ava is your AI guide for laptop.</span>
                  </div>
                </div>
              </motion.div>

              {/* Manual input */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  Manual Test Prompt
                </label>
                <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 backdrop-blur-xl p-3 sm:p-4 space-y-2">
                  <textarea
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none resize-none min-h-[56px] max-h-32 scrollbar-thin scrollbar-thumb-slate-700/70 scrollbar-track-transparent"
                    placeholder='(Testing only) Type: "Is this good for gaming?"'
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500">
                      In the real kiosk, customers just speak. This box is for
                      developer testing.
                    </p>
                    <button
                      onClick={handleSendMessage}
                      disabled={!isAvatarReady || !message.trim()}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition
                        ${
                          isAvatarReady && message.trim()
                            ? "bg-indigo-500 text-white hover:bg-indigo-400"
                            : "bg-slate-700/60 text-slate-400 cursor-not-allowed"
                        }`}
                    >
                      <Mic className="h-3.5 w-3.5" />
                      Send to Ava
                    </button>
                  </div>
                </div>
              </div>

              {/* Dev camera preview */}
              {/* <details className="text-xs text-slate-500">
                <summary className="cursor-pointer select-none">
                  Developer: toggle camera preview
                </summary>
                <div className="mt-2 rounded-xl border border-slate-700/60 bg-slate-950/70 p-2 inline-block">
                  <video
                    ref={camPreviewRef}
                    autoPlay
                    playsInline
                    className="w-60 h-auto rounded-lg bg-black"
                  />
                </div>
              </details> */}
            </div>

            {/* RIGHT: Specs */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-2xl border border-slate-700/80 bg-slate-950/80 backdrop-blur-xl p-4 sm:p-5 shadow-lg shadow-indigo-900/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-indigo-300">
                      Display Laptop
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-50 flex items-center gap-2">
                      {LAPTOP_SPECS.model}
                    </h2>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-400/50 px-3 py-2 text-[11px] text-indigo-50">
                    <div className="flex items-center gap-1">
                      <Monitor className="h-3.5 w-3.5" />
                      <span>Ask Ava:</span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      <li>• How much RAM is there?</li>
                      <li>• Is this good for gaming?</li>
                      <li>• Can I do video editing?</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <SpecCard
                    icon={Cpu}
                    label="Processor"
                    value={LAPTOP_SPECS.cpu}
                  />
                  <SpecCard
                    icon={MemoryStick}
                    label="Memory"
                    value={`${LAPTOP_SPECS.ramGB} GB RAM`}
                  />
                  <SpecCard
                    icon={HardDrive}
                    label="Storage"
                    value={LAPTOP_SPECS.storage}
                  />
                  <SpecCard
                    icon={Monitor}
                    label="Graphics"
                    value={LAPTOP_SPECS.gpu}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <div>OS: {LAPTOP_SPECS.os}</div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/70 px-2 py-0.5">
                      <Bot className="h-3 w-3 text-indigo-300" />
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Status */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-700/80 bg-slate-950/80 backdrop-blur-xl p-4 text-xs text-slate-300 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p>{status}</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  Tip: in kiosk mode, customers only speak to the laptop. The
                  avatar auto-starts when someone is in front of the screen
                  (using face detection), or after a short fallback delay if
                  face detection is not supported.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const SpecCard = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 backdrop-blur-lg px-3 py-3 flex flex-col gap-1 shadow-sm shadow-slate-900/70">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
      <Icon className="h-3.5 w-3.5 text-indigo-300" />
      <span>{label}</span>
    </div>
    <p className="text-sm text-slate-100 leading-snug">{value}</p>
  </div>
);

export default AvatarPage;
