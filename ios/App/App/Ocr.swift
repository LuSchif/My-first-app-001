import Capacitor
import UIKit
import Vision

/// Reads the text in a picture of a page with Apple's Vision recognizer: handwriting and typed
/// text, German and English, on the device. The web app sends a JPEG (base64) and gets the
/// lines back, top to bottom.
@objc(OcrPlugin)
public class OcrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OcrPlugin"
    public let jsName = "Ocr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognize(_ call: CAPPluginCall) {
        guard let base64 = call.getString("image"),
              let data = Data(base64Encoded: base64),
              let image = UIImage(data: data)?.cgImage
        else {
            call.reject("No picture to read")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.recognitionLanguages = ["de-DE", "en-US"]
            if #available(iOS 16.0, *) {
                request.automaticallyDetectsLanguage = true
            }
            do {
                try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
            } catch {
                call.reject("Could not read the picture", nil, error)
                return
            }
            // Vision's boxes start at the bottom left: higher lines have larger y.
            let lines = (request.results ?? [])
                .sorted { a, b in
                    abs(a.boundingBox.midY - b.boundingBox.midY) > 0.01
                        ? a.boundingBox.midY > b.boundingBox.midY
                        : a.boundingBox.minX < b.boundingBox.minX
                }
                .compactMap { $0.topCandidates(1).first?.string }
            call.resolve(["text": lines.joined(separator: "\n")])
        }
    }
}
