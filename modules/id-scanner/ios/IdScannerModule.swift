import ExpoModulesCore
import UIKit
import Vision

/**
 Reads the text off a photograph.

 Apple's Vision does the recognition; nothing here interprets what it finds —
 which line is a name and which is a date is decided in JavaScript, where it
 can be corrected without a rebuild. This returns the lines and their
 confidence, in the order Vision found them.

 Thai first in `recognitionLanguages`: the order is a preference, and a Thai ID
 carries both scripts. Asked for English first, the Thai lines come back as
 mangled Latin.
 */
public class IdScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("IdScanner")

    AsyncFunction("readText") { (uri: String) -> [[String: Any]] in
      guard let url = URL(string: uri) else {
        throw Exception(name: "BadURI", description: "Not a URL: \(uri)")
      }
      guard let data = try? Data(contentsOf: url), let image = UIImage(data: data) else {
        throw Exception(name: "Unreadable", description: "Could not read the image")
      }
      guard let cgImage = image.cgImage else {
        throw Exception(name: "NoBitmap", description: "The image has no bitmap")
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      request.recognitionLanguages = ["th-TH", "en-US"]

      let handler = VNImageRequestHandler(
        cgImage: cgImage,
        orientation: cgOrientation(image.imageOrientation),
        options: [:]
      )
      try handler.perform([request])

      let observations = request.results ?? []
      return observations.compactMap { observation in
        guard let best = observation.topCandidates(1).first else { return nil }
        return [
          "text": best.string,
          "confidence": Double(best.confidence),
          // Where it sat on the card, normalised. The parser uses it to keep
          // lines in reading order rather than Vision's own.
          "y": Double(observation.boundingBox.origin.y),
          "x": Double(observation.boundingBox.origin.x),
        ]
      }
    }
  }

  /// UIKit's orientation as Core Graphics states it — a photograph straight
  /// from the camera is rarely stored upright.
  private func cgOrientation(_ orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch orientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
