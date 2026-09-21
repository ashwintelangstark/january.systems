#ifndef AUDIO_CONTROLLER_H
#define AUDIO_CONTROLLER_H

#include <Arduino.h>
#include "config.h"

class AudioController {
public:
  AudioController();
  void begin();
  void update();

  // ISD1820 Hardware Controls
  void startRecording();
  void stopRecording();
  void playRecording(uint16_t estimatedDurationMs = 3000);

  bool getIsRecording() const { return isRecording; }
  bool getIsPlaying() const { return isPlaying; }

private:
  bool isRecording;
  bool isPlaying;
  unsigned long playStartTime;
  unsigned long playDuration;
};

#endif // AUDIO_CONTROLLER_H
