import ExpoModulesCore

/**
 Closing the calendar the compact date picker opened.

 `UIDatePicker` in its compact style puts its calendar in a popover of its own
 and keeps it up after a day is tapped: it is built for a picker you might go on
 adjusting, and there is no property, delegate or notification for saying the
 choice is made. What there is, is a presented view controller — so this finds
 the one on top and dismisses it.

 Narrowly, though. The topmost presented controller is just as likely to be one
 of the app's own sheets, and dismissing that would close the page under the
 finger. Only a popover qualifies, and only one UIKit presented itself: every
 sheet in this app is presented by React Native, whose controllers are neither
 popovers nor named anything like a calendar.
 */
public class DatePopoverModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DatePopover")

    Function("dismiss") {
      // The call arrives on the JS thread; UIKit is not to be touched there.
      DispatchQueue.main.async { Self.dismissPopover() }
    }
  }

  private static func dismissPopover() {
    guard let top = topmost(), top.presentingViewController != nil else { return }

    let name = String(describing: type(of: top))
    // Nothing the app itself put on screen. React Native's controllers all
    // carry its prefixes, and a bare class name is not worth guessing at.
    guard !name.hasPrefix("RCT"), !name.hasPrefix("EX") else { return }
    let popover = top.modalPresentationStyle == .popover
    guard popover || name.contains("DatePicker") || name.contains("Calendar")
    else { return }

    /*
      How it goes away.

      A popover shrinks back into the control it came out of, which is the
      right way for this one to leave: it grew out of the date and belongs to
      it. Anything else UIKit sees off by sliding it down and out of the
      bottom of the screen — the exit of a sheet, which reads as the page
      being dismissed rather than the calendar being closed. That one is cut
      rather than played: gone the instant the day is tapped is not the
      animation we wanted, but it is not the wrong one either.
    */
    top.dismiss(animated: popover)
  }

  /// The view controller on top of everything, popovers included.
  private static func topmost() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap {
      $0 as? UIWindowScene
    }
    let windows = scenes.flatMap { $0.windows }
    guard let window = windows.first(where: { $0.isKeyWindow }) ?? windows.first
    else { return nil }

    var top = window.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }
}
