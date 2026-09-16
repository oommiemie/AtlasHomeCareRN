import ActivityKit
import Foundation

/// The visit the assistant is sitting in on, and how it is going.
public struct ScribeActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// "listening", "paused" or "ready".
    public var phase: String
    /// When the current stretch of listening began — the island counts up
    /// from it on its own, with no help from the app.
    public var startedAt: Date
    /// Seconds already on the clock when `startedAt` was set, so a pause
    /// and a resume do not restart the count.
    public var carried: Double
    /// How many of the subjects have come up.
    public var covered: Int
    public var total: Int

    public init(phase: String, startedAt: Date, carried: Double, covered: Int, total: Int) {
      self.phase = phase
      self.startedAt = startedAt
      self.carried = carried
      self.covered = covered
      self.total = total
    }
  }

  /// Who is being visited — fixed for the life of the activity.
  public var patient: String

  public init(patient: String) {
    self.patient = patient
  }
}
