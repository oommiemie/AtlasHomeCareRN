import ExpoModulesCore
import MapKit

/**
 A real `MKMarkerAnnotationView`, hosted in a view of our own.

 The point of this module is that nothing here draws a pin. MapKit does, from
 the same class Apple Maps uses, so the balloon, its shadow, the way it grows
 when selected and whatever the current version of iOS decides a marker should
 look like all come from the system rather than from a drawing that has to be
 redone each time the system changes.

 It sits outside a map view on purpose. `<Marker>` with no children is meant to
 give us this view through the map library, and under the New Architecture —
 where that library runs through the interop layer — it comes back with nothing
 drawn at all. A marker that carries a child does render, so the annotation view
 is handed back as that child.
 */
final class AppleMarkerView: ExpoView {
  /// `MKMarkerAnnotationView` needs an annotation to configure itself against;
  /// it never reaches a map, so a bare point is enough.
  private let point = MKPointAnnotation()
  private lazy var marker: MKMarkerAnnotationView = {
    let view = MKMarkerAnnotationView(annotation: point, reuseIdentifier: nil)
    view.isUserInteractionEnabled = false
    view.canShowCallout = false
    return view
  }()

  /// Where in this view the balloon's point should land, from the top. The
  /// caller anchors the marker on the same number.
  private var tipY: CGFloat = 56

  private var glyphImageUri: String?
  private var glyphSystemImage: String?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // The balloon is larger than the box when it is selected, and its shadow
    // falls outside it either way.
    clipsToBounds = false
    addSubview(marker)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    place()
  }

  func setTint(_ hex: String?) {
    marker.markerTintColor = hex.flatMap(AppleMarkerView.color(from:))
    setNeedsLayout()
  }

  func setGlyphText(_ text: String?) {
    marker.glyphText = (text?.isEmpty ?? true) ? nil : text
    setNeedsLayout()
  }

  func setGlyphImageUri(_ uri: String?) {
    glyphImageUri = uri
    applyGlyphImage()
  }

  func setGlyphSystemImage(_ name: String?) {
    glyphSystemImage = name
    applyGlyphImage()
  }

  func setSelected(_ selected: Bool) {
    // Not animated: the pin is re-created on every re-render of the marker, so
    // an animation would play against a view that was never in the other state.
    marker.setSelected(selected, animated: false)
    setNeedsLayout()
  }

  func setTipY(_ value: Double) {
    tipY = CGFloat(value)
    setNeedsLayout()
  }

  /// The bundled glyph if we can read it, the system symbol if we cannot.
  private func applyGlyphImage() {
    if let uri = glyphImageUri, let image = AppleMarkerView.image(at: uri) {
      marker.glyphImage = image.withRenderingMode(.alwaysTemplate)
    } else if let name = glyphSystemImage {
      marker.glyphImage = UIImage(systemName: name)?.withRenderingMode(.alwaysTemplate)
    } else {
      marker.glyphImage = nil
    }
    setNeedsLayout()
  }

  private func place() {
    marker.sizeToFit()
    var size = marker.bounds.size
    if size.width < 1 || size.height < 1 {
      // A standalone annotation view has no one to size it; this is the size
      // MapKit gives the marker on a map.
      size = CGSize(width: 40, height: 50)
      marker.bounds = CGRect(origin: .zero, size: size)
    }

    // MapKit places an annotation view so that `center = coordinate +
    // centerOffset`, which for a balloon puts the offset above the point. If
    // the view has not declared one, the point is its bottom edge.
    var offset = marker.centerOffset
    if offset == .zero {
      offset = CGPoint(x: 0, y: -size.height / 2)
    }
    marker.center = CGPoint(x: bounds.midX + offset.x, y: tipY + offset.y)
  }

  /// Reads a bundled asset. In a release build React Native hands us a `file:`
  /// URL into the app bundle; the image is redrawn at the screen's scale and at
  /// the size a marker glyph wants, because the file itself carries neither.
  private static func image(at uri: String) -> UIImage? {
    let path = uri.hasPrefix("file://") ? String(uri.dropFirst("file://".count)) : uri
    guard path.hasPrefix("/"),
          let raw = UIImage(contentsOfFile: path.removingPercentEncoding ?? path)
    else { return nil }

    let side: CGFloat = 20
    let scale = max(raw.size.width, raw.size.height)
    guard scale > 0 else { return nil }
    let box = CGSize(width: raw.size.width / scale * side, height: raw.size.height / scale * side)

    let format = UIGraphicsImageRendererFormat.default()
    format.opaque = false
    return UIGraphicsImageRenderer(size: box, format: format).image { _ in
      raw.draw(in: CGRect(origin: .zero, size: box))
    }
  }

  private static func color(from hex: String) -> UIColor? {
    var text = hex.trimmingCharacters(in: .whitespaces)
    if text.hasPrefix("#") { text.removeFirst() }
    guard text.count == 6, let value = UInt32(text, radix: 16) else { return nil }
    return UIColor(
      red: CGFloat((value >> 16) & 0xFF) / 255,
      green: CGFloat((value >> 8) & 0xFF) / 255,
      blue: CGFloat(value & 0xFF) / 255,
      alpha: 1
    )
  }
}

public class AppleMarkerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleMarker")

    View(AppleMarkerView.self) {
      Prop("tint") { (view: AppleMarkerView, value: String?) in view.setTint(value) }
      Prop("glyphText") { (view: AppleMarkerView, value: String?) in view.setGlyphText(value) }
      Prop("glyphImageUri") { (view: AppleMarkerView, value: String?) in view.setGlyphImageUri(value) }
      Prop("glyphSystemImage") { (view: AppleMarkerView, value: String?) in
        view.setGlyphSystemImage(value)
      }
      Prop("selected") { (view: AppleMarkerView, value: Bool) in view.setSelected(value) }
      Prop("tipY") { (view: AppleMarkerView, value: Double) in view.setTipY(value) }
    }
  }
}
