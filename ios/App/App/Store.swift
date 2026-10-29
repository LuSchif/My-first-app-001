import Capacitor
import StoreKit

/// In-app purchases for the Broomit shop, with StoreKit 2: the web app asks for prices, buys,
/// and asks what is owned. Apple signs every transaction and StoreKit checks the signature on
/// the device, so no server of our own is needed.
@objc(StorePlugin)
public class StorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorePlugin"
    public let jsName = "Store"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "owned", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
    ]

    private var updates: Task<Void, Never>?

    override public func load() {
        // Purchases finished elsewhere (approved by a parent, made on another device, refunded)
        // arrive here; the web app then asks again what is owned.
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                    self?.notifyListeners("changed", data: ["productId": transaction.productID])
                }
            }
        }
    }

    deinit {
        updates?.cancel()
    }

    /// The products' names and prices as the App Store shows them, in the buyer's currency.
    @objc func products(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do {
                let found = try await Product.products(for: ids)
                call.resolve([
                    "products": found.map { product in
                        ["id": product.id, "title": product.displayName, "price": product.displayPrice]
                    }
                ])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// Shows Apple's purchase sheet; resolves "purchased", "pending" or "cancelled".
    @objc func buy(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("No product given")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("This product is not in the App Store yet")
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.reject("The purchase could not be verified")
                        return
                    }
                    await transaction.finish()
                    call.resolve(["status": "purchased"])
                case .pending:
                    call.resolve(["status": "pending"])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                @unknown default:
                    call.resolve(["status": "cancelled"])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// The products owned now (bought and not refunded).
    @objc func owned(_ call: CAPPluginCall) {
        Task {
            call.resolve(["ids": await Self.entitlements()])
        }
    }

    /// "Restore purchases": syncs with the App Store (it may ask to sign in), then what is owned.
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["ids": await Self.entitlements()])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private static func entitlements() async -> [String] {
        var ids: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.revocationDate == nil {
                ids.append(transaction.productID)
            }
        }
        return ids
    }
}

/// The app's screen: Capacitor's web view, with Broomit's own native plugins added.
class BroomitViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(StorePlugin())
    }
}
