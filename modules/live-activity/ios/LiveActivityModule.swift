import ActivityKit
import ExpoModulesCore

/**
 The assistant's Live Activity, from the app's side.

 ActivityKit is driven from the app process: the widget extension only draws.
 So this is three calls — start, update, end — and the record of which
 activity is ours, kept here because the JS side has no handle to hold. Every
 call is guarded on 16.2 and on the user having allowed Live Activities, and
 answers `false` rather than throwing, so the sheet's own pill can stand in
 wherever the island cannot.
 */
public class LiveActivityModule: Module {
  @available(iOS 16.2, *)
  private static var current: Activity<ScribeActivityAttributes>?

  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    /// Whether this phone can show one at all.
    Function("isAvailable") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    /// Begin: `patient` on the banner, `state` as the first frame.
    AsyncFunction("start") { (patient: String, state: [String: Any]) -> Bool in
      guard #available(iOS 16.2, *),
            ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
      // One at a time: a second start replaces the first rather than stacking.
      if let live = Self.current {
        await live.end(nil, dismissalPolicy: .immediate)
        Self.current = nil
      }
      let attributes = ScribeActivityAttributes(patient: patient)
      let content = ActivityContent(state: Self.decode(state), staleDate: nil)
      do {
        Self.current = try Activity.request(attributes: attributes, content: content, pushType: nil)
        return true
      } catch {
        return false
      }
    }

    /// Move it on: a new phase, a new clock, more subjects covered.
    AsyncFunction("update") { (state: [String: Any]) -> Bool in
      guard #available(iOS 16.2, *), let live = Self.current else { return false }
      await live.update(ActivityContent(state: Self.decode(state), staleDate: nil))
      return true
    }

    /// Done — the island lets go of it straight away.
    AsyncFunction("end") { () -> Bool in
      guard #available(iOS 16.2, *), let live = Self.current else { return false }
      await live.end(nil, dismissalPolicy: .immediate)
      Self.current = nil
      return true
    }
  }

  /// JS sends plain values; the state wants its dates as dates.
  @available(iOS 16.2, *)
  private static func decode(_ raw: [String: Any]) -> ScribeActivityAttributes.ContentState {
    let startedMs = (raw["startedAt"] as? Double) ?? Date().timeIntervalSince1970 * 1000
    return ScribeActivityAttributes.ContentState(
      phase: (raw["phase"] as? String) ?? "listening",
      startedAt: Date(timeIntervalSince1970: startedMs / 1000),
      carried: (raw["carried"] as? Double) ?? 0,
      covered: (raw["covered"] as? Int) ?? 0,
      total: (raw["total"] as? Int) ?? 0
    )
  }
}
