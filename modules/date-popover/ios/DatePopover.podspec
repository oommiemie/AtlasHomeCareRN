Pod::Spec.new do |s|
  s.name           = 'DatePopover'
  s.version        = '1.0.0'
  s.summary        = "Closing the date picker's own popover."
  s.description    = "The compact date picker opens its calendar in a popover it does not close after a day is picked, and offers no way to ask it to. This finds that popover and dismisses it."
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
