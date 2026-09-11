Pod::Spec.new do |s|
  s.name           = 'SegmentedControl'
  s.version        = '1.0.0'
  s.summary        = "UIKit's own segmented control."
  s.description    = 'A thin wrapper over UISegmentedControl, so a picker of two to five choices is the one the system draws.'
  s.author         = 'Atlas HomeCare'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
