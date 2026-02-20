import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Home, MessageCircle, Brain, ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Soft background orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-48 h-48 bg-purple-200/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-100/10 rounded-full blur-3xl" />

      <motion.div
        className="text-center relative z-10 max-w-lg mx-auto px-6"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring" }}
      >
        {/* Icon cluster */}
        <motion.div
          className="mb-8 relative inline-block"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
            <Compass className="h-12 w-12 text-primary" />
          </div>
          <motion.div
            className="absolute -top-2 -right-2 w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Heart className="h-4 w-4 text-pink-500" />
          </motion.div>
        </motion.div>

        {/* Main text */}
        <h1 className="text-6xl font-bold text-gradient mb-3">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">
          It's okay to feel lost sometimes
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          This page doesn't exist, but that's alright — every journey has unexpected turns. Let us guide you back to a safe space.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Button
            onClick={() => navigate("/")}
            className="gradient-primary hover-glow gap-2"
            size="lg"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Button>
          <Button
            onClick={() => navigate("/chat")}
            variant="outline"
            size="lg"
            className="gap-2 bg-white/60 backdrop-blur-sm"
          >
            <MessageCircle className="h-4 w-4" />
            Talk to MindMitra
          </Button>
        </div>

        {/* Gentle suggestion */}
        <motion.div
          className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100 p-4 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="font-medium text-gray-700">While you're here...</span>
          </div>
          <p>
            Take a deep breath in for 4 seconds, hold for 4, and exhale for 6.
            Even a moment of mindfulness can shift your day. 🌿
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFound;
