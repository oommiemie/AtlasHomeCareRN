Pod::Spec.new do |s|
  s.name           = 'IdScanner'
  s.version        = '1.0.0'
  s.summary        = 'Reads the text off a photograph of a Thai national ID card.'
  s.description    = 'A thin wrapper over Vision text recognition, in Thai and English.'
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
