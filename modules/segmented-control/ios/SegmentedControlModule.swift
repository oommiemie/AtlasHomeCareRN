import ExpoModulesCore

/**
 UIKit's own segmented control.

 Drawn by the system rather than by us, which on iOS 26 means the selected
 segment is a Liquid Glass capsule that slides between the choices, presses
 with the finger and picks up the device's accent — none of which is worth
 reproducing by hand, and none of which would stay right when the next version
 of iOS changes it.
 */
final class SegmentedControlView: ExpoView {
  private let control = UISegmentedControl()

  /// Fired with the index the user moved to. Named to match the JS prop.
  private let onSegmentChange = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    control.addTarget(self, action: #selector(valueChanged), for: .valueChanged)
    addSubview(control)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    control.frame = bounds
  }

  /**
   The index the app has asked for, held apart from the control's own.

   Props arrive in whatever order the renderer sends them, and on the first
   pass `selectedIndex` can land before `segments` — at which point the control
   has no segments to select and the request has nowhere to go. Dropped, it
   never comes again: the prop does not change, so it is never re-sent, and the
   control sits with nothing selected. Kept here, it is applied the moment
   there is something to apply it to.
   */
  private var wanted = -1

  func setSegments(_ titles: [String]) {
    // Rebuilt rather than edited: the control has no way to reorder or rename
    // in place, and the list is four items long.
    control.removeAllSegments()
    for (i, title) in titles.enumerated() {
      control.insertSegment(withTitle: title, at: i, animated: false)
    }
    applyWanted()
  }

  func setSelectedIndex(_ index: Int) {
    wanted = index
    applyWanted()
  }

  private func applyWanted() {
    guard wanted >= 0, wanted < control.numberOfSegments else { return }
    // Only when it differs: assigning the value the control already holds is
    // harmless, but doing it while the user's own tap is still animating
    // cancels the animation.
    if control.selectedSegmentIndex != wanted {
      control.selectedSegmentIndex = wanted
    }
  }

  @objc private func valueChanged() {
    onSegmentChange(["index": control.selectedSegmentIndex])
  }
}

public class SegmentedControlModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SegmentedControl")

    View(SegmentedControlView.self) {
      Events("onSegmentChange")
      Prop("segments") { (view: SegmentedControlView, titles: [String]) in
        view.setSegments(titles)
      }
      Prop("selectedIndex") { (view: SegmentedControlView, index: Int) in
        view.setSelectedIndex(index)
      }
    }
  }
}
