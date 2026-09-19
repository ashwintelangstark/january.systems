import AVFoundation
import CoreMedia
import Foundation

class CaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
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

func main() {
    let args = CommandLine.arguments
    let outputPath = args.count > 1 ? args[1] : "/tmp/january_cam_snapshot.jpg"

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

        // Pump RunLoop for sensor warm-up (auto-exposure, auto-white balance)
        let warmupStart = Date()
        while Date().timeIntervalSince(warmupStart) < 0.6 {
            RunLoop.current.run(until: Date().addingTimeInterval(0.08))
        }

        let delegate = CaptureDelegate()
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

main()
