import AVFoundation
import CoreImage
import CoreMedia
import Foundation

class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    var done = false
    var capturedData: Data?
    var captureError: Error?

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let data = photo.fileDataRepresentation() {
            capturedData = data
        } else {
            captureError = error
        }
        done = true
    }
}

class VideoStreamDelegate: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    let outputPath: String
    let tmpPath: String
    let ciContext = CIContext()
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    var frameCount = 0
    var lastFrameTime = Date()

    init(outputPath: String) {
        self.outputPath = outputPath
        self.tmpPath = outputPath + ".tmp"
        super.init()
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let ciImage = CIImage(cvImageBuffer: imageBuffer)
        guard let jpegData = ciContext.jpegRepresentation(of: ciImage, colorSpace: colorSpace, options: [:]) else { return }

        do {
            let tmpURL = URL(fileURLWithPath: tmpPath)
            let outURL = URL(fileURLWithPath: outputPath)
            try jpegData.write(to: tmpURL, options: .atomic)
            _ = try? FileManager.default.replaceItemAt(outURL, withItemAt: tmpURL)
            frameCount += 1

            let now = Date()
            if now.timeIntervalSince(lastFrameTime) >= 5.0 {
                let currentFps = Double(frameCount) / now.timeIntervalSince(lastFrameTime)
                fputs("STREAM_FPS:\(String(format: "%.1f", currentFps))\n", stderr)
                frameCount = 0
                lastFrameTime = now
            }
        } catch {
            // Non-fatal frame write error
        }
    }
}

var shouldKeepRunning = true

func setupSignalHandlers() {
    signal(SIGINT) { _ in
        shouldKeepRunning = false
    }
    signal(SIGTERM) { _ in
        shouldKeepRunning = false
    }
}

func runStreamMode(outputPath: String, targetFps: Int) {
    setupSignalHandlers()

    guard let device = AVCaptureDevice.default(for: .video) else {
        fputs("ERROR: No video capture device found\n", stderr)
        exit(1)
    }

    do {
        let session = AVCaptureSession()
        session.sessionPreset = .high

        let input = try AVCaptureDeviceInput(device: device)
        if session.canAddInput(input) {
            session.addInput(input)
        }

        // Configure Frame Rate (60 FPS or device max)
        try device.lockForConfiguration()
        var supportedFps = 30
        for format in device.formats {
            for range in format.videoSupportedFrameRateRanges {
                if Int(range.maxFrameRate) > supportedFps {
                    supportedFps = Int(range.maxFrameRate)
                }
            }
        }
        let requestedFps = min(targetFps, supportedFps)
        let frameDuration = CMTime(value: 1, timescale: CMTimeScale(requestedFps))
        device.activeVideoMinFrameDuration = frameDuration
        device.activeVideoMaxFrameDuration = frameDuration
        device.unlockForConfiguration()

        let videoOutput = AVCaptureVideoDataOutput()
        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)
        ]

        let delegate = VideoStreamDelegate(outputPath: outputPath)
        let queue = DispatchQueue(label: "com.january.videoStreamQueue", qos: .userInteractive)
        videoOutput.setSampleBufferDelegate(delegate, queue: queue)

        if session.canAddOutput(videoOutput) {
            session.addOutput(videoOutput)
        }

        session.startRunning()
        fputs("OK:STREAMING_ACTIVE:\(outputPath):\(requestedFps)FPS\n", stdout)
        fflush(stdout)

        while shouldKeepRunning {
            RunLoop.current.run(until: Date().addingTimeInterval(0.01))
        }

        session.stopRunning()
        fputs("OK:STREAMING_STOPPED\n", stdout)
        exit(0)
    } catch {
        fputs("ERROR: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
}

func runOneShotMode(outputPath: String) {
    guard let device = AVCaptureDevice.default(for: .video) else {
        fputs("ERROR: No video capture device found\n", stderr)
        exit(1)
    }

    do {
        let session = AVCaptureSession()
        session.sessionPreset = .photo

        let input = try AVCaptureDeviceInput(device: device)
        if session.canAddInput(input) {
            session.addInput(input)
        }

        let output = AVCapturePhotoOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
        }

        session.startRunning()

        let warmupStart = Date()
        while Date().timeIntervalSince(warmupStart) < 0.6 {
            RunLoop.current.run(until: Date().addingTimeInterval(0.08))
        }

        let delegate = PhotoCaptureDelegate()
        let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        output.capturePhoto(with: settings, delegate: delegate)

        let waitStart = Date()
        while !delegate.done && Date().timeIntervalSince(waitStart) < 3.5 {
            RunLoop.current.run(until: Date().addingTimeInterval(0.08))
        }

        session.stopRunning()

        if let data = delegate.capturedData {
            let fileURL = URL(fileURLWithPath: outputPath)
            try data.write(to: fileURL)
            print("OK:\(outputPath):\(data.count)")
            exit(0)
        } else if let err = delegate.captureError {
            fputs("ERROR: Capture failed: \(err.localizedDescription)\n", stderr)
            exit(2)
        } else {
            fputs("ERROR: Capture timed out\n", stderr)
            exit(3)
        }
    } catch {
        fputs("ERROR: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
}

func main() {
    let args = CommandLine.arguments
    if args.count >= 3 && args[1] == "--stream" {
        let outputPath = args[2]
        let fps = args.count >= 4 ? (Int(args[3]) ?? 60) : 60
        runStreamMode(outputPath: outputPath, targetFps: fps)
    } else if args.count >= 3 && args[1] == "--oneshot" {
        runOneShotMode(outputPath: args[2])
    } else {
        let outputPath = args.count > 1 ? args[1] : "/tmp/january_cam_snapshot.jpg"
        runOneShotMode(outputPath: outputPath)
    }
}

main()
