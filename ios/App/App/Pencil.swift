import Capacitor
import UIKit

/// The Apple Pencil's own gestures, which web pages never see: the double tap (Pencil 2, Pro)
/// and the squeeze (Pencil Pro). They reach the web app as "tap" and "squeeze" events, with
/// what the person chose in Settings › Apple Pencil and, when the pencil hovers, where it is
/// (in web page points).
@objc(PencilPlugin)
public class PencilPlugin: CAPPlugin, CAPBridgedPlugin, UIPencilInteractionDelegate {
    public let identifier = "PencilPlugin"
    public let jsName = "Pencil"
    public let pluginMethods: [CAPPluginMethod] = []

    override public func load() {
        DispatchQueue.main.async { [weak self] in
            guard let self, let view = self.bridge?.webView else { return }
            let interaction = UIPencilInteraction()
            interaction.delegate = self
            view.addInteraction(interaction)
        }
    }

    private func action(_ preferred: UIPencilPreferredAction) -> String {
        switch preferred {
        case .switchEraser: return "eraser"
        case .switchPrevious: return "previous"
        case .showColorPalette: return "palette"
        case .showInkAttributes: return "attributes"
        case .ignore: return "ignore"
        default: return "other"
        }
    }

    private func send(_ event: String, action: String, at location: CGPoint?) {
        var data: [String: Any] = ["action": action]
        if let location {
            data["x"] = location.x
            data["y"] = location.y
        }
        notifyListeners(event, data: data)
    }

    @available(iOS 17.5, *)
    public func pencilInteraction(
        _ interaction: UIPencilInteraction, didReceiveTap tap: UIPencilInteraction.Tap
    ) {
        send("tap", action: action(UIPencilInteraction.preferredTapAction),
             at: tap.hoverPose?.location)
    }

    @available(iOS 17.5, *)
    public func pencilInteraction(
        _ interaction: UIPencilInteraction, didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze
    ) {
        guard squeeze.phase == .ended else { return }
        send("squeeze", action: action(UIPencilInteraction.preferredSqueezeAction),
             at: squeeze.hoverPose?.location)
    }

    /// Before iPadOS 17.5 there is only the double tap, without a location.
    public func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        if #available(iOS 17.5, *) { return }
        send("tap", action: action(UIPencilInteraction.preferredTapAction), at: nil)
    }
}
