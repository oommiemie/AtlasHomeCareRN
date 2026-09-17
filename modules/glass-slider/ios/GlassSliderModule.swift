import ExpoModulesCore
import SwiftUI

/**
 SwiftUI's own slider, with the tick marks iOS 26 gave it.

 UIKit's `UISlider` has never had ticks — the guidelines call them a macOS
 feature, and the React Native community wrapper wraps `UISlider`, so the
 ticks under it were ours, drawn over the control and lining up with it only
 by arithmetic. iOS 26 added them to SwiftUI's `Slider` (`tick:`, alongside a
 neutral value and enabled bounds), and this is that control, hosted.

 Which means the ticks sit where the system puts them, the thumb covers the
 one it is on because the system draws it that way, and the whole thing picks
 up whatever the next version of iOS does to sliders.
 */
final class SliderModel: ObservableObject {
  @Published var value: Double = 0
  @Published var steps: Int = 5

  /// Every step crossed while a finger is down.
  var onSlide: ((Double) -> Void)?
  /// The one it came to rest on.
  var onSettle: ((Double) -> Void)?

  /**
   True only while the user is dragging.

   The binding's setter runs for the app's own writes as well as the user's,
   and reporting those back would put the two ends in a loop — JS sets the
   value, native reports it, JS sets it again. Only a real drag is news.
   */
  var dragging = false

  var upper: Double { Double(max(steps - 1, 1)) }
}

/** The app's blue, so the filled track is not the system accent. */
private let TRACK_TINT = Color(red: 7 / 255, green: 125 / 255, blue: 215 / 255)

@available(iOS 26.0, *)
private struct TickedSlider: View {
  @ObservedObject var model: SliderModel

  var body: some View {
    Slider(
      value: Binding(
        get: { model.value },
        set: { next in
          model.value = next
          if model.dragging { model.onSlide?(next) }
        }
      ),
      in: 0...model.upper,
      step: 1,
      label: { Text(verbatim: "") },
      tick: { at in SliderTick(at) },
      onEditingChanged: { editing in
        model.dragging = editing
        if !editing { model.onSettle?(model.value) }
      }
    )
    .tint(TRACK_TINT)
  }
}

/** Below iOS 26 there are no ticks to have; the slider is still the system's. */
private struct PlainSlider: View {
  @ObservedObject var model: SliderModel

  var body: some View {
    Slider(
      value: Binding(
        get: { model.value },
        set: { next in
          model.value = next
          if model.dragging { model.onSlide?(next) }
        }
      ),
      in: 0...model.upper,
      step: 1,
      onEditingChanged: { editing in
        model.dragging = editing
        if !editing { model.onSettle?(model.value) }
      }
    )
    .tint(TRACK_TINT)
  }
}

private struct GlassSliderBody: View {
  @ObservedObject var model: SliderModel

  var body: some View {
    if #available(iOS 26.0, *) {
      TickedSlider(model: model)
    } else {
      PlainSlider(model: model)
    }
  }
}

final class GlassSliderView: ExpoView {
  private let onSlide = EventDispatcher()
  private let onSettle = EventDispatcher()

  private let model = SliderModel()
  private var host: UIHostingController<GlassSliderBody>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    model.onSlide = { [weak self] value in
      self?.onSlide(["value": value])
    }
    model.onSettle = { [weak self] value in
      self?.onSettle(["value": value])
    }

    let controller = UIHostingController(rootView: GlassSliderBody(model: model))
    // The card behind it shows through: a hosting controller's view is
    // opaque white by default, which would print a block across the card.
    controller.view.backgroundColor = .clear
    host = controller
    addSubview(controller.view)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    host?.view.frame = bounds
  }

  func setValue(_ value: Double) {
    // Never while a finger is on it: the app echoes the value back as the
    // drag reports it, and writing it here would fight the gesture.
    guard !model.dragging else { return }
    model.value = value
  }

  func setSteps(_ steps: Int) {
    model.steps = steps
  }
}

public class GlassSliderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlassSlider")

    View(GlassSliderView.self) {
      Events("onSlide", "onSettle")

      Prop("value") { (view: GlassSliderView, value: Double) in
        view.setValue(value)
      }
      Prop("steps") { (view: GlassSliderView, steps: Int) in
        view.setSteps(steps)
      }
    }
  }
}
