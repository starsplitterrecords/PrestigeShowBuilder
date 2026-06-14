import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_9w_scene_script',
  description: 'Scene Writing Pass 0.9W',
  slots: [
    'EPISODE_CONTEXT',
    'REGISTER_GUIDANCE',
    'CHARACTER_VOICES',
    'EPISODE_SCENE_MAP',
    'ACT_NUMBER',
    'SCENE_NUMBER',
    'SCENE_TITLE',
    'SCENE_SETTING',
    'SCENE_WANT',
    'SCENE_FUNCTION',
    'SCENE_BEATS'
  ],
  render: (i) => `You are the screenwriter for this graphic novel. Write THIS ONE SCENE in full, as a screenplay — the way it would actually play on the page. Take all the room the scene needs.

${i.EPISODE_CONTEXT}
${i.REGISTER_GUIDANCE ? i.REGISTER_GUIDANCE + '\n' : ''}
${i.CHARACTER_VOICES ? i.CHARACTER_VOICES + '\n' : ''}

=== THIS SINGLE SCENE TO WRITE ===
Act: ${i.ACT_NUMBER}, Scene: ${i.SCENE_NUMBER}
Title: ${i.SCENE_TITLE}
Setting: ${i.SCENE_SETTING}

=== SCENE BEATS (your dramatic spine) ===
${i.SCENE_BEATS}

=== THIS SCENE'S PURPOSE ===
What this scene must accomplish (its dramatic want): ${i.SCENE_WANT}
Its function in the issue: ${i.SCENE_FUNCTION}
Write the scene to ACHIEVE this — not merely to depict the beats.

=== WHERE THIS SCENE SITS ===
${i.EPISODE_SCENE_MAP}

Write THIS scene knowing the others:
- Do not re-cover what an EARLIER scene established. Reference, don't repeat.
- Do not preempt a LATER scene's payoff; you may set it up.
- Honor continuity: what characters now know, where things stand.

=== STYLE EXEMPLAR (match the TEXTURE and DENSITY, not the content) ===
This is a different story in a different setting. Do NOT borrow its content, characters, or setting. Match how it BREATHES: two people circling a subject, voices distinct, subtext under plain words, the world surfacing in what they reference and take for granted, the scene earning its ending across many exchanges.

INT. BREAK-ROOM - DAY
Carrie watches the coffee machine drip. Gunnar stands by the water cooler, holding a tiny paper cup like it's a bird.

GUNNAR
How does it know to stop?

CARRIE
It has a sensor, Gunnar.

GUNNAR
And if the sensor falls asleep? Or forgets?

CARRIE
Then we get a flood. But it hasn't forgotten in three years.

GUNNAR
A dangerous trust. Back on the salt-flats, we didn't trust anything that didn't have eyes. Even then, we watched the eyes.

CARRIE
Well, here we trust the little blue light. (pointing) See? It turned green. It's done.

Gunnar stares at the green light, then back at his paper cup.

GUNNAR
It's very small. The portion.

CARRIE
You can have two. Nobody's counting.

GUNNAR
In the long-lodge, the chief drank from a hollowed skull. It held a gallon of mead. If you finished it, you were allowed to speak.

CARRIE
Here, if you finish a cup, you get a mild heart palpitation and a strong desire to file your reports on time.

GUNNAR
(dryly)
A different kind of warrior's trial.

CARRIE
Exactly. Now, about the incident in the lobby...

GUNNAR
The metal gates had teeth, Carrie. They were closing on the small child.

CARRIE
It was a revolving door. It rotates. Slowly.

GUNNAR
It was a trap for the unwary. I freed him.

CARRIE
You shattered three panes of tempered glass with a fire extinguisher.

GUNNAR
The child lives.

CARRIE
The child's parents are suing the agency, Gunnar.

GUNNAR
They should thank me. I showed them their son's guardian spirit is wakeful.

CARRIE
They thanked us by sending a process server. He's downstairs right now.

Gunnar sighs, tossing the small paper cup into the bin. He misses. It bounces off the rim. He doesn't pick it up.

GUNNAR
He has no honor, this paper-man.

CARRIE
He has a law degree. In this world, that's the equivalent of a heavy broadsword.

GUNNAR
Then I must prepare my defense. Where is the fire extinguisher?

CARRIE
No fire extinguishers. We're going to sit there, we're going to smile, and we're going to let the lawyers talk.

GUNNAR
A quiet death, then.

=== HOW TO WRITE ===
- The beats are the SPINE of what happens — they are perhaps a tenth of the words. The scene you write is much longer than the beat list.
- A conversation scene typically runs many exchanges — twenty or more back-and-forths is normal. Do NOT resolve a scene in a handful of lines. If two people are talking, let it breathe.
- Silence and small action are part of the rhythm, but the words carry the scene. Write the words.
- Each scene's beats above are the skeleton — what must happen, in order. Write the real scene AROUND and BETWEEN them. Do not just narrate the beats; dramatise them.
- Write the way the best long-form comics are written: characters talk to each other, not to the plot. Let them circle a subject, disagree, joke, misunderstand, return to it. Let the world come out sideways in how they speak — what they reference, complain about, take for granted.
- Decompress. A real conversation breathes across many exchanges. Two people in a room can carry pages. Do NOT compress a scene into a few functional lines.
- Voice is everything. Each character must sound unmistakably like themselves per the voices above. If two characters could swap a line without anyone noticing, rewrite both.
- Subtext over statement. People rarely say the thing directly. Let what they avoid carry weight.
- Earn the beats. A line lands because the lines before it built to it.
- Action lines describe what we see between dialogue — gesture, object, silence — sparingly and concretely.

=== DO NOT ===
- Do not write to a panel or page count. You are writing the scene, not laying it out. Pagination happens later.
- Do not state what a picture will obviously show ('he looks angry').
- Do not flatten distinct voices into one narrator.

=== OUTPUT FORMAT ===
Return JSON for THIS SINGLE SCENE: the full screenplay text with action lines and dialogue.
Provide ONLY valid JSON. Absolutely no markdown outside the JSON block. Do NOT wrap the JSON block in anything other than \`\`\`json.

The single-scene JSON shape is one WrittenScene object:
\`\`\`json
{
  "actNumber": 1,
  "sceneNumber": 1,
  "title": "...",
  "setting": "...",
  "screenplay": "INT. ... — ...\\n\\nFull screenplay text with action lines and dialogue, in reading order..."
}
\`\`\`
`
};

registerPromptTemplate(template);
export default template;
