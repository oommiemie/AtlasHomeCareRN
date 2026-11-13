Pod::Spec.new do |s|
  s.name           = 'AtlasKeys'
  s.version        = '1.0.0'
  s.summary        = 'Hardware keyboard shortcuts on iPad.'
  s.description    = 'Registers UIKeyCommands (Cmd+K, Cmd+F, Cmd+1-4, Cmd+N, Esc) on the root view controller and passes each press to JavaScript.'
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
