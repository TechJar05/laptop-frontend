import { FaceDetection } from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';

class FaceDetectionService {
  constructor() {
    this.faceDetection = null;
    this.camera = null;
    this.isInitialized = false;
    this.onFaceDetected = null;
    this.onFaceDistanceChanged = null;
    this.lastFaceDetectionTime = 0;
    this.consecutiveNoFaceFrames = 0;
    this.isFacePresent = false;
    this.faceDistance = null;
  }

  /**
   * Initialize face detection
   */
  async initialize(videoElement, callbacks = {}) {
    try {
      console.log('Initializing face detection...');

      this.onFaceDetected = callbacks.onFaceDetected;
      this.onFaceDistanceChanged = callbacks.onFaceDistanceChanged;

      // Create face detection instance
      this.faceDetection = new FaceDetection({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        }
      });

      // Configure face detection
      this.faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5
      });

      // Set up result handler
      this.faceDetection.onResults((results) => {
        this.processResults(results);
      });

      // Initialize camera
      this.camera = new Camera(videoElement, {
        onFrame: async () => {
          if (this.faceDetection) {
            await this.faceDetection.send({ image: videoElement });
          }
        },
        width: 640,
        height: 480
      });

      await this.camera.start();
      this.isInitialized = true;

      console.log('Face detection initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize face detection:', error);
      throw error;
    }
  }

  /**
   * Process face detection results
   */
  processResults(results) {
    const now = Date.now();
    
    if (results.detections && results.detections.length > 0) {
      // Face detected
      this.consecutiveNoFaceFrames = 0;
      
      const detection = results.detections[0];
      const boundingBox = detection.boundingBox;
      
      // Calculate approximate distance based on face size
      // Larger face = closer to camera
      const faceWidth = boundingBox.width;
      const faceHeight = boundingBox.height;
      const faceSize = Math.sqrt(faceWidth * faceWidth + faceHeight * faceHeight);
      
      // Approximate distance categories
      // >0.4 = very close (<0.5m)
      // 0.3-0.4 = close (0.5-1m) 
      // 0.2-0.3 = medium (1-1.5m)
      // <0.2 = far (>1.5m)
      
      let distance = 'far';
      let isWithinRange = false;
      
      if (faceSize > 0.4) {
        distance = 'very_close';
        isWithinRange = true;
      } else if (faceSize > 0.3) {
        distance = 'close'; // This is our target range (within 1 meter)
        isWithinRange = true;
      } else if (faceSize > 0.2) {
        distance = 'medium';
        isWithinRange = false;
      } else {
        distance = 'far';
        isWithinRange = false;
      }
      
      // Update face status
      if (!this.isFacePresent) {
        this.isFacePresent = true;
        if (this.onFaceDetected) {
          this.onFaceDetected(true, isWithinRange, distance);
        }
      }
      
      // Update distance if changed
      if (this.faceDistance !== distance) {
        this.faceDistance = distance;
        if (this.onFaceDistanceChanged) {
          this.onFaceDistanceChanged(distance, isWithinRange, faceSize);
        }
      }
      
      this.lastFaceDetectionTime = now;
      
    } else {
      // No face detected
      this.consecutiveNoFaceFrames++;
      
      // Only trigger "no face" after 30 consecutive frames (~1 second)
      if (this.consecutiveNoFaceFrames > 30 && this.isFacePresent) {
        this.isFacePresent = false;
        this.faceDistance = null;
        
        if (this.onFaceDetected) {
          this.onFaceDetected(false, false, null);
        }
      }
    }
  }

  /**
   * Check if face is currently detected
   */
  isFaceCurrentlyDetected() {
    return this.isFacePresent;
  }

  /**
   * Get current face distance
   */
  getCurrentDistance() {
    return this.faceDistance;
  }

  /**
   * Stop face detection
   */
  async stop() {
    try {
      if (this.camera) {
        this.camera.stop();
        this.camera = null;
      }
      
      if (this.faceDetection) {
        this.faceDetection.close();
        this.faceDetection = null;
      }
      
      this.isInitialized = false;
      this.isFacePresent = false;
      this.faceDistance = null;
      
      console.log('Face detection stopped');
    } catch (error) {
      console.error('Error stopping face detection:', error);
    }
  }

  /**
   * Restart face detection
   */
  async restart(videoElement, callbacks) {
    await this.stop();
    await this.initialize(videoElement, callbacks);
  }
}

export default new FaceDetectionService();
