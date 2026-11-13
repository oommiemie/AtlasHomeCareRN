import ExpoModulesCore
import UIKit

/// Hardware keyboard shortcuts on an iPad with a keyboard attached.
///
/// UIKit hears a keyboard through key commands, which belong to a view
/// controller in the responder chain. They are added to the window's root
/// controller once it exists, and each press is posted to JavaScript as an
/// "onKey" event with the key and whether ⌘ was held; what a key does is
/// decided there (see src/utils/keyboardShortcuts.ts), the same as on the web.
public class AtlasKeysModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("AtlasKeys")
    Events("onKey")

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: AtlasKeys.pressed, object: nil, queue: .main
      ) { [weak self] note in
        self?.sendEvent("onKey", note.userInfo as? [String: Any] ?? [:])
      }
      DispatchQueue.main.async { AtlasKeys.install() }
    }

    OnStopObserving {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
      }
      self.observer = nil
    }
  }
}

enum AtlasKeys {
  static let pressed = Notification.Name("AtlasKeysPressed")
  private static var installedOn: UIViewController?

  static func install(attempt: Int = 0) {
    let window = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow } ?? UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first
    guard let root = window?.rootViewController else {
      // The window comes up a moment after the bridge; try again shortly.
      if attempt < 20 {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { install(attempt: attempt + 1) }
      }
      return
    }
    if installedOn === root { return }
    installedOn = root

    func command(_ input: String, _ flags: UIKeyModifierFlags, _ title: String) -> UIKeyCommand {
      let c = UIKeyCommand(
        title: title, action: #selector(UIResponder.atlasKeyPressed(_:)),
        input: input, modifierFlags: flags)
      // Ahead of the system's own ⌘F (find) and the like.
      c.wantsPriorityOverSystemBehavior = true
      return c
    }
    let commands: [UIKeyCommand] = [
      command("k", .command, "Search"),
      command("f", .command, "Search"),
      command("n", .command, "Start today's round"),
      command("1", .command, "Home"),
      command("2", .command, "Visit plan"),
      command("3", .command, "Services"),
      command("4", .command, "Me"),
      command(UIKeyCommand.inputEscape, [], "Back"),
    ]
    commands.forEach { root.addKeyCommand($0) }
  }
}

extension UIResponder {
  /// Whatever responder the press reaches first, the press goes to JS.
  @objc func atlasKeyPressed(_ sender: UIKeyCommand) {
    let input = sender.input == UIKeyCommand.inputEscape ? "Escape" : (sender.input ?? "")
    NotificationCenter.default.post(
      name: AtlasKeys.pressed, object: nil,
      userInfo: ["key": input, "meta": sender.modifierFlags.contains(.command)])
  }
}
