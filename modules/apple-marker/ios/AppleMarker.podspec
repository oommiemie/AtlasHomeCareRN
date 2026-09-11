Pod::Spec.new do |s|
  s.name           = 'AppleMarker'
  s.version        = '1.0.0'
  s.summary        = "MapKit's own map marker, as a view a marker can carry."
  s.description    = 'Hosts a real MKMarkerAnnotationView outside a map view, so the pins are the ones the system draws rather than a drawing of them.'
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
