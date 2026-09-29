import ActivityKit
import SwiftUI
import WidgetKit

/*
 The assistant, in the Dynamic Island.

 Four faces, as every Live Activity has: the compact pair either side of the
 camera, the minimal dot when another activity has the island, the expanded
 sheet when it is held, and the lock-screen banner. All of them say the same
 three things — that it is listening, for how long, and how far through the
 subjects the visit has got — at whatever size they are given.

 Red while listening, grey while held, the app's blue once the draft is
 ready: the same three states the sheet's own pill wears, so the island and
 the app never disagree about what the assistant is doing.
 */

/// The words on the clear pane: the app's own black, and it at half.
/// The assistant's own mark — a two-tone gradient that is none of the three
/// status inks, so the badge reads as "this is the AI" and not as a state.
/// Cyan into violet, the way a model's own marks tend to be drawn.
private let aiGradient = LinearGradient(
  colors: [Color(red: 0.16, green: 0.82, blue: 0.86), Color(red: 0.55, green: 0.36, blue: 1.0)],
  startPoint: .topLeading,
  endPoint: .bottomTrailing
)
private let aiTint = Color(red: 0.42, green: 0.55, blue: 0.95)

private let paneInk = Color(red: 0.07, green: 0.07, blue: 0.07)
private let paneInkSoft = Color(red: 0.07, green: 0.07, blue: 0.07).opacity(0.6)

private let listening = Color(red: 1.0, green: 0.22, blue: 0.24)
private let held = Color(red: 0.60, green: 0.64, blue: 0.69)
private let ready = Color(red: 0.03, green: 0.49, blue: 0.84)

private func ink(for phase: String) -> Color {
  switch phase {
  case "listening": return listening
  case "paused": return held
  default: return ready
  }
}

/// Thai where the phone is Thai, English otherwise — the widget runs in
/// its own process and cannot read the app's language choice, so it
/// follows the phone's.
private let thai = Locale.preferredLanguages.first?.hasPrefix("th") ?? true

private func caption(for phase: String) -> String {
  switch phase {
  case "listening": return thai ? "กำลังฟัง" : "Listening"
  case "paused": return thai ? "หยุดชั่วคราว" : "Paused"
  default: return thai ? "ร่างพร้อมแล้ว" : "Draft ready"
  }
}

/// The running clock: counts by itself from `startedAt`, carrying what was
/// already on it; stands still at the carried figure while held.
private struct Clock: View {
  let state: ScribeActivityAttributes.ContentState

  var body: some View {
    // A timer text reserves the width of its largest figure and lays the
    // digits out from the *left* of that box, so "0:09" sat a digit's
    // width in from the edge while "0:57" — a plain string — sat flush.
    // The box is held at the width of "59:59" and the digits pushed to its
    // trailing edge, so every figure lines up on the right.
    clock
      .multilineTextAlignment(.trailing)
      .frame(minWidth: 0, alignment: .trailing)
  }

  @ViewBuilder private var clock: some View {
    if state.phase == "listening" {
      // Bounded at an hour, not at the end of time. A timer text reserves
      // room for the *largest* figure its range can reach, and a range that
      // ran to `distantFuture` reserved room for days — which is why the
      // island had stretched to the width of the screen for a nine-second
      // count. No visit is an hour; m:ss is what it needs.
      let began = state.startedAt.addingTimeInterval(-state.carried)
      Text(timerInterval: began...began.addingTimeInterval(3599), countsDown: false)
        .monospacedDigit()
    } else {
      let s = Int(state.carried)
      Text(String(format: "%d:%02d", s / 60, s % 60)).monospacedDigit()
    }
  }
}

/// The sound. SF Symbols draws the waveform and, on iOS 17, animates it.
private struct Wave: View {
  let phase: String
  var body: some View {
    let glyph = Image(systemName: phase == "listening" ? "waveform" : "waveform.slash")
      .foregroundStyle(ink(for: phase))
    if #available(iOS 17.0, *), phase == "listening" {
      glyph.symbolEffect(.variableColor.iterative.reversing, options: .repeating)
    } else {
      glyph
    }
  }
}

/// The sound, under the clock: a row of bars at the heights a voice leaves.
///
/// A still trace, not a running one — a lock-screen Live Activity is a frame
/// the system redraws when told to, and neither custom animation nor a
/// symbol effect runs in the banner. So this is the shape a few seconds of
/// speech leaves on a level meter, in the state's colour, dimmed to a low
/// even line while held. It reads as "sound", and in grey as "no sound now".
private struct Trace: View {
  let phase: String
  private let heights: [CGFloat] = [4, 8, 5, 11, 14, 8, 12, 6, 13, 9, 5, 10, 6, 12, 7, 4]

  var body: some View {
    HStack(alignment: .center, spacing: 2.5) {
      ForEach(Array(heights.enumerated()), id: \.offset) { _, h in
        Capsule()
          .fill(ink(for: phase))
          .frame(width: 2.5, height: phase == "paused" ? 3 : h)
      }
    }
    .opacity(phase == "paused" ? 0.5 : 0.95)
  }
}

/// The subjects as a row of dots — filled in order as they are covered.
private struct Dots: View {
  let covered: Int
  let total: Int
  let ink: Color

  var body: some View {
    HStack(spacing: 5) {
      ForEach(0..<total, id: \.self) { i in
        Circle()
          .fill(i < covered ? ink : ink.opacity(0.001))
          .overlay(
            Circle().strokeBorder(i < covered ? .clear : Color.secondary.opacity(0.5), lineWidth: 1.4)
          )
          .frame(width: 7, height: 7)
      }
    }
    .padding(.top, 1)
  }
}


struct ScribeActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ScribeActivityAttributes.self) { context in
      // The lock screen, and the banner over other apps.
      //
      // A clear pane, not a dark one. Left to itself the system's material
      // comes out dark on the lock screen whatever the wallpaper; a
      // near-transparent white tint laid over it turns it into the light
      // frosted glass the design's own surfaces wear, with the wallpaper
      // showing through. The inks are then set dark by hand: the lock
      // screen styles itself as dark mode, so `.primary` there is white,
      // which would vanish on a light pane.
      HStack(spacing: 14) {
        Image(systemName: "sparkles")
          .font(.system(size: 22, weight: .semibold))
          .foregroundStyle(aiGradient)
          .frame(width: 44, height: 44)
          .background(aiTint.opacity(0.16), in: Circle())
        VStack(alignment: .leading, spacing: 2) {
          Text(caption(for: context.state.phase))
            .font(.caption.weight(.bold))
            .foregroundStyle(ink(for: context.state.phase))
          Text(context.attributes.patient)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(paneInk)
            .lineLimit(1)
          // The subjects, as a row of dots, one per topic in order — filled
          // in the state's colour as each is covered, hollow while it waits.
          // A count said how many; the dots say how many *and which are
          // left*, at a glance, without a number to read.
          Dots(covered: context.state.covered, total: context.state.total, ink: ink(for: context.state.phase))
        }
        Spacer(minLength: 0)
        VStack(alignment: .trailing, spacing: 4) {
          Clock(state: context.state)
            .font(.system(size: 26, weight: .bold, design: .rounded))
            .foregroundStyle(paneInk)
            .frame(width: 76, alignment: .trailing)
          // No trace once the draft is ready: there is no sound to show, and
          // an empty waveform under a finished clock reads as still going.
          if context.state.phase != "ready" {
            Trace(phase: context.state.phase)
              .frame(width: 76, height: 14)
          }
        }
      }
      .padding(16)
      .activityBackgroundTint(Color.white.opacity(0.42))
      .activitySystemActionForegroundColor(paneInk)
    } dynamicIsland: { context in
      DynamicIsland {
        // Held down: the whole story.
        DynamicIslandExpandedRegion(.leading) {
          Wave(phase: context.state.phase)
            .font(.system(size: 26, weight: .medium))
            .frame(width: 40, height: 40)
            .background(ink(for: context.state.phase).opacity(0.16), in: Circle())
        }
        DynamicIslandExpandedRegion(.trailing) {
          Clock(state: context.state)
            .font(.system(size: 26, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: 76, alignment: .trailing)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            Text(caption(for: context.state.phase))
              .font(.caption.weight(.bold))
              .foregroundStyle(ink(for: context.state.phase))
            Text(context.attributes.patient)
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(.white)
              .lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          // The subjects, as a row of dots that fill as they are covered.
          HStack(spacing: 6) {
            ForEach(0..<max(context.state.total, 1), id: \.self) { i in
              Capsule()
                .fill(i < context.state.covered ? ink(for: "ready") : Color.white.opacity(0.18))
                .frame(height: 4)
            }
          }
          .padding(.top, 4)
        }
      } compactLeading: {
        Wave(phase: context.state.phase)
          .font(.system(size: 15, weight: .semibold))
      } compactTrailing: {
        Clock(state: context.state)
          .font(.system(size: 14, weight: .semibold, design: .rounded))
          .foregroundStyle(ink(for: context.state.phase))
          .frame(width: 38, alignment: .trailing)
      } minimal: {
        Wave(phase: context.state.phase)
          .font(.system(size: 14, weight: .semibold))
      }
      .keylineTint(ink(for: context.state.phase))
    }
  }
}

@main
struct ScribeActivityBundle: WidgetBundle {
  var body: some Widget {
    ScribeActivityWidget()
  }
}
