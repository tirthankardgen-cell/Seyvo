using System;
using System.Collections.Generic;
using System.IO;
using System.Media;

// Original short tones, synthesized locally. SoundPlayer uses the normal
// Windows audio mixer: system/app volume and mute are never changed.
internal static class CuePlayer {
  static readonly Dictionary<string, SoundPlayer> Players = new Dictionary<string, SoundPlayer>();
  static readonly List<MemoryStream> Streams = new List<MemoryStream>();

  public static void Play(string cue) {
    double[] notes;
    if(cue == "start") notes = new double[] { 660, 880 };
    else if(cue == "stop") notes = new double[] { 880, 660 };
    else if(cue == "error") notes = new double[] { 330, 220 };
    else throw new InvalidOperationException("invalid-cue");
    try {
      SoundPlayer player;
      if(!Players.TryGetValue(cue, out player)) {
        const int rate = 22050, samplesPerNote = 1654;
        MemoryStream stream = new MemoryStream();
        BinaryWriter writer = new BinaryWriter(stream);
        int dataLength = samplesPerNote * notes.Length * 2;
        writer.Write(new char[] { 'R','I','F','F' }); writer.Write(36 + dataLength);
        writer.Write(new char[] { 'W','A','V','E','f','m','t',' ' }); writer.Write(16);
        writer.Write((short)1); writer.Write((short)1); writer.Write(rate);
        writer.Write(rate * 2); writer.Write((short)2); writer.Write((short)16);
        writer.Write(new char[] { 'd','a','t','a' }); writer.Write(dataLength);
        foreach(double frequency in notes) {
          for(int i=0; i<samplesPerNote; i++) {
            double envelope = Math.Min(1, Math.Min(i / 180.0, (samplesPerNote - 1 - i) / 260.0));
            writer.Write((short)(2400 * envelope * Math.Sin(2 * Math.PI * frequency * i / rate)));
          }
        }
        writer.Flush(); stream.Position = 0;
        player = new SoundPlayer(stream); player.Load();
        Streams.Add(stream); Players.Add(cue, player);
      }
      player.Play(); // Asynchronous; never blocks microphone or insertion work.
    } catch { throw new InvalidOperationException("sound-unavailable"); }
  }

  public static void Close() {
    foreach(SoundPlayer player in Players.Values) { player.Stop(); player.Dispose(); }
    foreach(MemoryStream stream in Streams) stream.Dispose();
    Players.Clear(); Streams.Clear();
  }
}
