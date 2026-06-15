Pod::Spec.new do |s|
  s.name           = 'SchedularmAlarm'
  s.version        = '0.1.0'
  s.summary        = 'Bespoke reverse-alarm native module for schedularm'
  s.description    = 'Reverse-alarm native module: Android (AlarmManager + full-screen Activity) and iOS (AlarmKit).'
  s.author         = ''
  s.homepage       = 'https://github.com/umean/schedularm'
  s.platforms      = {
    :ios => '26.0'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  s.resources = "**/*.lproj/*.strings"
end
