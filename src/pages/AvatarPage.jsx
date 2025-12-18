import React, { useEffect, useRef, useState } from "react";
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
  Zap,
  Activity,
  CircleDot,
  Send,
} from "lucide-react";
import { createClient } from "@anam-ai/js-sdk"; // ✅ Anam SDK
import FaceDetectionService from "../services/FaceDetectionService";

// 🔑 API key (move to .env in real project)
const ANAM_API_KEY =
  "ODhmY2JlZmItNGZhMS00NjM0LWI4MzQtMDRhMjM0MGQ1MTNhOmZwbHgzMFNoaTFqT04wK2NpRXQ4WTZiMlZHV2NWd2RUdUlRa0lVdWhzVnc9";
// Laptop specs for the persona prompt
const LAPTOP_SPECS = {
  model: "HP Pavilion 15",
  cpu: "Intel Core i5 12450H",
  ramGB: 16,
  storage: "512GB NVMe SSD",
  gpu: "NVIDIA GTX 1650 4GB",
  os: "Windows 11 Home",
};

// Persona config for Anam
const PERSONA_CONFIG = {
  name: "Ava",
  avatarId: "30fa96d0-26c4-4e55-94a0-517025942e18",
  voiceId: "91627ebb-7530-4235-bbf2-8c12af2e601c",
  llmId: "ANAM_GPT_4O_MINI_V1",
  systemPrompt: `
You are "Ava", an AI laptop SALES ASSISTANT in a showroom.

You are standing next to ONE SPECIFIC LAPTOP on display.
You are NOT the laptop. You are a human-like sales executive talking ABOUT this laptop.

This specific laptop has the following real specs:
- Model: ${LAPTOP_SPECS.model}
- Processor (CPU): ${LAPTOP_SPECS.cpu}
- RAM: ${LAPTOP_SPECS.ramGB} GB
- Storage: ${LAPTOP_SPECS.storage}
- Graphics (GPU): ${LAPTOP_SPECS.gpu}
- Operating System: ${LAPTOP_SPECS.os}

### VERY IMPORTANT SPEAKING STYLE

- Always talk like a salesperson in a shop.
- Always refer to the machine as “this laptop”, “this model”, “this device”, or “it”.
- NEVER say “I have 16 GB RAM” or “I am good for gaming”.
- INSTEAD say:
  - “This laptop has 16 GB RAM.”
  - “This model is very good for light gaming.”
  - “It is suitable for video editing.”

### INTRODUCTION BEHAVIOUR

When a new customer comes (or at the start of conversation), give a short, friendly sales-style intro like this:

- Greet the customer.
- Briefly mention the key highlights of this laptop using the real specs above.
- Mention 2–3 ideal use cases (gaming, office work, study, programming, editing etc.)
- Example style (YOU SHOULD PARAPHRASE, NOT REPEAT EXACTLY):
  “Namaste! I’m Ava, your laptop advisor. This laptop ${LAPTOP_SPECS.model} comes with ${LAPTOP_SPECS.ramGB} GB RAM and a ${LAPTOP_SPECS.cpu} processor, along with ${LAPTOP_SPECS.storage} storage. It’s great for daily work, online classes, and even some light gaming.”

Keep intro around 20–30 seconds, not too long.

### HARDWARE QUESTIONS (OFFLINE LOGIC)

1. If the customer asks about hardware details like:
   - RAM
   - processor / CPU
   - storage / SSD / HDD / space
   - graphics card / GPU
   - operating system / Windows version

   Then:
   - Answer ONLY using the exact values from the specs list above.
   - Do NOT guess or invent new hardware values.
   - Example:
     - Q: “How much RAM is there?”
       A: “This laptop has ${LAPTOP_SPECS.ramGB} GB of RAM.”
     - Q: “Which processor does it have?”
       A: “It comes with a ${LAPTOP_SPECS.cpu} processor.”

### SMART ADVICE (ONLINE LOGIC)

2. If they ask things like:
   - “Is this good for gaming?”
   - “Can I use this for video editing?”
   - “Is this good for programming?”
   - “Can I run GTA 5?”
   - “Is this better than an i5 laptop?”

   Then:
   - Use your general knowledge about typical performance of these specs.
   - Explain in very simple, friendly, non-technical language.
   - Give a clear YES / NO / PARTIALLY answer plus a short explanation.
   - Example style:
     - “This laptop is good for casual gaming like FIFA or Valorant on medium settings, but for heavy AAA games it may struggle.”
     - “This is very good for programming and multitasking because of its ${LAPTOP_SPECS.ramGB} GB RAM and ${LAPTOP_SPECS.cpu} processor.”

   - If something is NOT ideal, be honest but polite:
     - “It can run basic editing, but for heavy 4K video editing I would suggest a higher-end laptop.”

### TONE & LANGUAGE

3. Tone:
   - Warm, polite, sales-friendly.
   - Non-technical, explain concepts in simple words.
   - Speak like you are helping a non-IT customer choose the right laptop.

4. Always focus on:
   - What this laptop IS GOOD FOR.
   - What this laptop is NOT IDEAL for (if asked), in a gentle way.
`,
};

const AvatarPage = () => {
  const personaVideoRef = useRef(null);
  const camPreviewRef = useRef(null);

  const [status, setStatus] = useState("Initializing kiosk...");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [message, setMessage] = useState("");
  const [customerDetected, setCustomerDetected] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Internal refs for Anam handling
  const anamClientRef = useRef(null);
  const avatarStartedRef = useRef(false);

  // -----------------------------
  // Camera + Face Detection setup (Mediapipe)
  // -----------------------------
  useEffect(() => {
    let cancelled = false;

    const initCameraAndDetect = async () => {
      try {
        setStatus("Initializing camera and face detection...");

        if (!camPreviewRef.current) {
          console.warn("Camera preview ref not ready");
          setStatus("Camera not ready.");
          return;
        }

        // Initialize Mediapipe camera + face detection
        await FaceDetectionService.initialize(camPreviewRef.current, {
          onFaceDetected: (isPresent, isWithinRange, distance) => {
            if (cancelled) return;

            console.log("Face detected?", isPresent, "distance:", distance);

            if (isPresent) {
              setCustomerDetected(true);

              if (isWithinRange) {
                setStatus("Customer in front of kiosk. Starting assistant...");
                // Start avatar ONLY once, and only when within range
                if (!avatarStartedRef.current) {
                  startAvatar();
                }
              } else {
                setStatus("Customer detected, please come a bit closer.");
              }
            } else {
              // No face
              setCustomerDetected(false);
              if (!avatarStartedRef.current) {
                setStatus("Waiting for customer...");
              }
            }
          },
          onFaceDistanceChanged: (distance, isWithinRange, faceSize) => {
            if (cancelled) return;
            console.log(
              "Face distance:",
              distance,
              "withinRange:",
              isWithinRange,
              "size:",
              faceSize
            );
            // Optional: you can use this later to tweak UI based on distance
          },
        });

        if (cancelled) return;

        setIsCameraReady(true);
        setStatus("Camera access granted. Waiting for customer...");
      } catch (error) {
        console.error("Failed to initialize camera/face detection:", error);
        if (!cancelled) {
          setStatus(
            "Camera or face detection failed. Please check permissions and reload."
          );
        }
      }
    };

    initCameraAndDetect();

    return () => {
      cancelled = true;

      // Stop Mediapipe detection
      FaceDetectionService.stop();

      // Stop Anam streaming if active
      if (anamClientRef.current) {
        anamClientRef.current
          .stopStreaming?.()
          .catch((err) => console.error("Error stopping Anam stream:", err));
      }
    };
  }, []);

  // -----------------------------
  // Start Anam avatar session
  // -----------------------------
  const startAvatar = async () => {
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

      // Important: pass the video element ID string
      await client.streamToVideoElement("persona-video");

      setIsAvatarReady(true);
      setStatus(
        "Assistant ready. Speak and ask about this laptop’s configuration."
      );

      // Intro speech
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

  // -----------------------------
  // Manual text → avatar
  // -----------------------------
  const handleSendMessage = () => {
    if (!message.trim()) return;

    setIsListening(true);
    setTimeout(() => setIsListening(false), 2000);

    if (anamClientRef.current) {
      anamClientRef.current.talk(message.trim());
    }

    setMessage("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          50% { transform: translate(10px, -10px) scale(1.1); opacity: 0.5; }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translate(0, 0) scale(1.2); opacity: 0.2; }
          50% { transform: translate(-10px, 10px) scale(1); opacity: 0.4; }
        }
        @keyframes float-center {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); opacity: 0.2; }
          50% { transform: translate(-50%, -50%) translateY(-20px); opacity: 0.3; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes wave {
          0%, 100% { height: 8px; }
          50% { height: 16px; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-left {
          from { opacity: 0; transform: translateX(-20px); }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide-right {
          from { opacity: 0; transform: translateX(20px); }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes border-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes dot-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        .animate-float { animation: float 8s ease-in-out infinite; }
        .animate-float-reverse { animation: float-reverse 10s ease-in-out infinite; }
        .animate-float-center { animation: float-center 6s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-wave-1 { animation: wave 0.6s ease-in-out infinite; }
        .animate-wave-2 { animation: wave 0.6s ease-in-out infinite 0.15s; }
        .animate-wave-3 { animation: wave 0.6s ease-in-out infinite 0.3s; }
        .animate-slide-up { animation: slide-up 0.8s ease-out; }
        .animate-slide-left { animation: slide-left 0.8s ease-out; }
        .animate-slide-right { animation: slide-right 0.8s ease-out; }
        .animate-border-pulse { animation: border-pulse 3s ease-in-out infinite; }
        .animate-dot-pulse { animation: dot-pulse 2s ease-in-out infinite; }
        .glass-morphism {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .neumorphic {
          background: linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        .inner-glow::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(to bottom right, rgba(255,255,255,0.04), transparent);
          pointer-events: none;
        }
      `}</style>

      {/* Hidden camera preview (for face detection) – UI unchanged */}
      <video
        ref={camPreviewRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-96 h-96 bg-gradient-to-br from-purple-600/30 to-blue-600/30 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-indigo-600/30 to-cyan-600/30 rounded-full blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-pink-600/20 to-purple-600/20 rounded-full blur-3xl animate-float-center" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4 md:p-8">
        <div className="w-full max-w-7xl animate-slide-up">
          {/* Header */}
          <div className="mb-8">
            <div className="relative glass-morphism neumorphic rounded-3xl p-6 inner-glow">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
                    <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                      <Bot className="h-7 w-7 text-white" />
                    </div>
                  </div>

                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-sans text-white flex items-center gap-2">
                      Smart-Specs Kiosk
                      <div className="animate-spin-slow">
                        <Sparkles className="h-5 w-5 text-indigo-400" />
                      </div>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                      Powered by intelligent avatar assistant
                    </p>
                  </div>
                </div>

                {/* Status indicators */}
                <div className="flex items-center gap-3">
                  {/* <StatusBadge
                    icon={Camera}
                    label="Camera"
                    active={isCameraReady}
                  />
                  <StatusBadge
                    icon={User}
                    label="Customer"
                    active={customerDetected}
                  /> */}
                  <StatusBadge
                    icon={Activity}
                    label="AI Ready"
                    active={isAvatarReady}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main content grid */}
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
            {/* Left column - Avatar */}
            <div className="space-y-6 animate-slide-left">
              {/* Avatar video container */}
              <div className="relative group">
                <div className="relative glass-morphism neumorphic rounded-3xl p-4 inner-glow">
                  <div className="relative overflow-hidden rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

                    <div className="absolute inset-0 rounded-2xl border-2 border-indigo-500/30 pointer-events-none animate-border-pulse" />

                    <video
                      id="persona-video"
                      ref={personaVideoRef}
                      autoPlay
                      playsInline
                      className="relative w-full h-[400px] object-cover rounded-2xl"
                      style={{
                        background:
                          "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                      }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                    {/* Listening indicator */}
                    {isListening && (
                      <div className="absolute top-4 right-4 glass-morphism bg-indigo-500/20 border border-indigo-400/30 rounded-2xl px-4 py-2 flex items-center gap-2 animate-slide-up">
                        <div className="animate-pulse-glow">
                          <Mic className="h-4 w-4 text-indigo-300" />
                        </div>
                        <span className="text-sm text-indigo-200 font-medium">
                          Listening...
                        </span>
                        <div className="flex gap-1">
                          <div
                            className="w-1 bg-indigo-400 rounded-full animate-wave-1"
                            style={{ height: "8px" }}
                          />
                          <div
                            className="w-1 bg-indigo-400 rounded-full animate-wave-2"
                            style={{ height: "8px" }}
                          />
                          <div
                            className="w-1 bg-indigo-400 rounded-full animate-wave-3"
                            style={{ height: "8px" }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Avatar name badge */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="glass-morphism bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-md animate-pulse-glow" />
                            <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                              <Sparkles className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Ava AI Assistant
                            </p>
                            <p className="text-xs text-slate-400">
                              Ready to help you
                            </p>
                          </div>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-dot-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message input */}
              <div className="relative glass-morphism neumorphic rounded-3xl p-5 inner-glow">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5" />
                      Message Input
                    </label>
                    {/* <span className="text-xs text-slate-500">
                      Developer Mode
                    </span> */}
                  </div>

                  <div className="relative">
                    <div className="relative glass-morphism border border-white/[0.05] rounded-2xl overflow-hidden shadow-inner">
                      <textarea
                        className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none resize-none p-4 min-h-[80px]"
                        placeholder='Try: "Is this good for gaming?" or "How much RAM does it have?"'
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                      />
                    </div>

                    <button
                      onClick={handleSendMessage}
                      disabled={!message.trim()}
                      className="absolute bottom-3 right-3 h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 disabled:from-slate-700 disabled:to-slate-800 flex items-center justify-center shadow-lg disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
                    >
                      <Send className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column - Specs & Status */}
            <div className="space-y-6 animate-slide-right">
              {/* Laptop specs card */}
              <div className="relative glass-morphism neumorphic rounded-3xl p-6 inner-glow">
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2">
                        Display Laptop
                      </p>
                      <h2 className="text-xl font-bold text-white">
                        {LAPTOP_SPECS.model}
                      </h2>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 flex items-center justify-center animate-spin-slow">
                      <Monitor className="h-6 w-6 text-indigo-300" />
                    </div>
                  </div>

                  {/* Specs grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <SpecCard
                      icon={Cpu}
                      label="Processor"
                      value={LAPTOP_SPECS.cpu}
                    />
                    <SpecCard
                      icon={MemoryStick}
                      label="Memory"
                      value={`${LAPTOP_SPECS.ramGB} GB`}
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

                  {/* OS badge */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-xs text-slate-400">
                      Operating System
                    </span>
                    <div className="glass-morphism border border-white/[0.05] rounded-lg px-3 py-1.5">
                      <span className="text-xs font-medium text-indigo-300">
                        {LAPTOP_SPECS.os}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick questions card */}
              <div className="relative glass-morphism neumorphic rounded-3xl p-6 inner-glow">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Try Asking Ava
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {[
                      "Is this good for gaming?",
                      "Can I do video editing?",
                      "How much RAM is available?",
                      "Is this suitable for students?",
                    ].map((q, i) => (
                      <div
                        key={i}
                        className="glass-morphism border border-white/[0.05] rounded-xl p-3 cursor-pointer hover:bg-white/[0.04] transition-all hover:translate-x-1"
                      >
                        <p className="text-sm text-slate-300 flex items-center gap-2">
                          <CircleDot className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                          {q}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status card */}
              <div className="relative glass-morphism neumorphic rounded-3xl p-5 inner-glow">
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0 animate-dot-pulse" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm text-white font-medium">{status}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      The kiosk automatically detects customers and activates
                      the AI assistant. Face detection enables seamless
                      interaction.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ icon: Icon, label, active }) => (
  <div
    className={`relative glass-morphism border rounded-xl px-3 py-2 flex items-center gap-2 transition-all ${
      active ? "bg-emerald-500/10 border-emerald-400/30" : "border-white/[0.05]"
    }`}
  >
    <Icon
      className={`h-3.5 w-3.5 ${
        active ? "text-emerald-400" : "text-slate-500"
      }`}
    />
    <span
      className={`text-xs font-medium ${
        active ? "text-emerald-300" : "text-slate-400"
      }`}
    >
      {label}
    </span>
    <div
      className={`h-1.5 w-1.5 rounded-full ${
        active ? "bg-emerald-400 animate-dot-pulse" : "bg-slate-600"
      }`}
    />
  </div>
);

const SpecCard = ({ icon: Icon, label, value }) => (
  <div className="relative group">
    <div className="relative glass-morphism border border-white/[0.05] rounded-2xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all group-hover:bg-white/[0.04] hover:-translate-y-0.5">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="relative space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/20 flex items-center justify-center">
            <Icon className="h-4 w-4 text-indigo-300" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {label}
          </span>
        </div>
        <p className="text-sm font-semibold text-white leading-snug">{value}</p>
      </div>
    </div>
  </div>
);

export default AvatarPage;
