
import { Type } from "@google/genai";
import { Show } from './types/models';

/**
 * AI RESPONSE SCHEMAS
 * Technical: Siloed schemas for each stage of the synthesis pipeline.
 */
export function buildSchemas(show?: Show) {
  // D291: Build the valid handle list from the show roster.
  const validHandles = show?.characters
    ?.map(c => c.handle)
    ?.filter(Boolean) as string[] ?? [];

  // Helper: build a characterHandle field with optional enum constraint.
  const handleField = validHandles.length > 0
    ? {
        type: Type.STRING,
        enum: validHandles,
        description: "Character handle. Must be one of the listed values.",
      }
    : {
        type: Type.STRING,
        description:
          "Character handle. Format: @SHOWCODE.charactername, e.g. @vik.bjorn",
      };

  return {
    minedConcept: {
      type: Type.OBJECT,
      properties: {
        titleSuggestion: { type: Type.STRING },
        premise: {
          type: Type.STRING,
          description: 'The core premise in the author\'s own language. ' +
            'Quote their exact sentences where possible. ' +
            'Do not reformat into logline or bullet structure. ' +
            'Preserve their voice, rhythm, and line breaks. ' +
            'Maximum 600 characters.',
        },
        worldRules: {
          type: Type.STRING,
          description: 'What is normal in this world. What rules govern it. ' +
            'Direct quotes from the source preferred. Max 300 characters.',
        },
        centralConflict: {
          type: Type.STRING,
          description: 'The central dramatic conflict in the author\'s framing. ' +
            'Use their words. Max 300 characters.',
        },
        emotionalCore: {
          type: Type.STRING,
          description: 'What the story is emotionally about. Direct quote preferred. ' +
            'Max 200 characters.',
        },
        themes: {
          type: Type.STRING,
          description: '3-5 thematic keywords extracted directly from the source. ' +
            'Use the author\'s exact terminology, not genre labels.',
        },
        seriesResolution: {
          type: Type.STRING,
          description: 'How the author describes the series ending or resolution, ' +
            'if stated. Empty string if not present in source. Max 200 characters.',
        },
      },
      required: ['titleSuggestion', 'premise', 'themes'],
    },
    expandConcept: {
      type: Type.OBJECT,
      properties: { 
        titleSuggestion: { type: Type.STRING }, 
        expandedPremise: { type: Type.STRING, description: "Must follow the PREMISE template exactly." },
        themes: { 
          type: Type.STRING, 
          description: "3-5 core thematic keywords extracted directly from the premise, comma-separated. Must reflect THIS show's world, not generic prestige drama themes. Format: 'theme one, theme two, theme three'" 
        }
      },
      required: ["titleSuggestion", "expandedPremise", "themes"],
    },
    
    characterCore: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          handle: { type: Type.STRING },
          role: { type: Type.STRING },
          physicalDescription: { type: Type.STRING, description: "Casting DNA summary." },
          castingNotes: { type: Type.STRING, description: "Age, build, and 'read'." },
          evolution: { type: Type.STRING },
          voiceProfile: { type: Type.STRING, description: "Voice type, pace, pitch, and verbal habits." },
        },
        required: ["name", "handle", "role", "physicalDescription", "castingNotes", "evolution", "voiceProfile"],
      }
    },

    characterSummary: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "The full CHARACTER template block (Snapshot through Production Notes)." },
        visualAnchor: {
          type: Type.STRING,
          description:
            "A compact visual description optimized for image generation consistency. " +
            "Must include: face shape, coloring (hair color/texture, eye color, skin tone), " +
            "build and height impression, 1-2 defining physical features, " +
            "default costume/silhouette, and one posture/presence note. " +
            "Write as a direct image prompt fragment — no abstractions, no psychology. " +
            "Example: 'Lean woman, mid-30s, angular jaw, close-cropped black hair, dark brown eyes, " +
            "olive skin. Wiry build. Blue tactical uniform, worn at elbows. " +
            "Stands with weight forward, always ready to move.' " +
            "80-120 words maximum.",
        },
      },
      required: ["summary", "visualAnchor"],
    },
    fullCharacterProfile: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "Full production narrative. 200-350 words.",
        },
        physicalDescription: {
          type: Type.STRING,
          description: "Casting DNA prose. 60-100 words.",
        },
        visualAnchor: {
          type: Type.STRING,
          description: "Compact image-generation descriptor. 80-120 words.",
        },
        castingNotes: {
          type: Type.STRING,
          description: "Real-world casting vision. 40-80 words.",
        },
        evolution: {
          type: Type.STRING,
          description: "Arc across the story. 2-3 sentences.",
        },
      },
      required: ["summary", "physicalDescription", "visualAnchor",
                 "castingNotes", "evolution"],
    },

    mineCharactersCore: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          handle: { type: Type.STRING },
          role: { type: Type.STRING },
          physicalDescription: { type: Type.STRING,
            description: 'Use the author\'s exact language from the source document.' },
          castingNotes: { type: Type.STRING,
            description: 'Only if stated or clearly derivable from source.' },
          evolution: { type: Type.STRING,
            description: 'Character arc if mentioned. Leave as empty string if not.' },
          voiceProfile: { type: Type.STRING,
            description: 'Voice/speech patterns if described. Empty string if not.' },
        },
        required: ['name', 'handle', 'role', 'physicalDescription'],
      }
    },

    mineCharacterSummary: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING,
          description: 'Full character block using only information from the source.' },
        visualAnchor: {
          type: Type.STRING,
          description:
            "A compact visual description optimized for image generation consistency. " +
            "Must include: face shape, coloring (hair color/texture, eye color, skin tone), " +
            "build and height impression, 1-2 defining physical features, " +
            "default costume/silhouette, and one posture/presence note. " +
            "Write as a direct image prompt fragment — no abstractions, no psychology. " +
            "80-120 words maximum.",
        },
      },
      required: ['summary', 'visualAnchor'],
    },
    
    characterConcept: {
      type: Type.OBJECT,
      properties: { 
        conceptPrompt: { type: Type.STRING, description: "15s single-shot cinematic description showing competence, contradiction, pressure, and cost." } 
      },
      required: ["conceptPrompt"],
    },
    
    seasonArc: {
      type: Type.OBJECT,
      properties: {
        thesis: {
          type: Type.STRING,
          description: 
            "Theme + Core question + Promise of season. Section 0 of SEASON_ARC."
        },
        engine: {
          type: Type.STRING,
          description: 
            "Episode engine + A/B Story patterns + Reset rule. Section 1."
        },
        spine: {
          type: Type.STRING,
          description: 
            "External objective + Primary force + Season clock + Escalation ladder. Section 2."
        },
        characterArcs: {
          type: Type.ARRAY,
          description: "Character Arc Lanes for 3-6 leads. Section 3.",
          items: {
            type: Type.OBJECT,
            properties: {
              handle: handleField,
              want: { type: Type.STRING },
              need: { type: Type.STRING },
              lie: { type: Type.STRING },
              pressure: { type: Type.STRING },
              breakingPoint: { type: Type.STRING },
              finalChoice: { type: Type.STRING },
            },
            required: ['handle', 'want', 'need', 'lie'],
          },
        },
        episodeTurns: {
          type: Type.ARRAY,
          description: 
            "One entry per episode. Inciting/Win-with-cost/Reversal/etc. Section 4.",
          items: {
            type: Type.OBJECT,
            properties: {
              episodeNumber: { type: Type.INTEGER },
              turnLabel: {
                type: Type.STRING,
                description: "Inciting disturbance, Win with cost, etc."
              },
              turnDescription: { type: Type.STRING },
            },
            required: ['episodeNumber', 'turnLabel', 'turnDescription'],
          },
        },
        ensembleMap: {
          type: Type.STRING,
          description: 
            "Core triangle + Alliance shifts + Payoff scene. Section 5."
        },
        episodeBeatTemplate: {
          type: Type.STRING,
          description: 
            "Cold open / Commitment / Complication / Midpoint twist / Confrontation / Outcome / Tag. Section 6."
        },
        escalation: {
          type: Type.STRING,
          description: 
            "Clue trail + Resource track + Heat level curve. Section 7."
        },
        finale: {
          type: Type.STRING,
          description: 
            "External climax + Internal climax + Cost paid + Door left open. Section 8."
        },
        outlineGrid: {
          type: Type.ARRAY,
          description: "Per-episode summary grid. Section 9.",
          items: {
            type: Type.OBJECT,
            properties: {
              episodeNumber: { type: Type.INTEGER },
              title: { type: Type.STRING },
              aStory: { type: Type.STRING },
              bStory: { type: Type.STRING },
              spineMovement: { type: Type.STRING },
              turn: { type: Type.STRING },
              endState: { type: Type.STRING },
            },
            required: ['episodeNumber', 'title', 'aStory', 'bStory', 'endState'],
          },
        },
        philosophicalMap: {
          type: Type.ARRAY,
          description: 
            "Faction map for non-protagonist ensemble characters. Section 10.",
          items: {
            type: Type.OBJECT,
            properties: {
              handle: handleField,
              faction: { type: Type.STRING },
              philosophy: { type: Type.STRING },
            },
            required: ['handle', 'faction', 'philosophy'],
          },
        },
      },
      required: [
        'thesis', 'engine', 'spine', 'characterArcs',
        'episodeTurns', 'finale', 'outlineGrid'
      ],
    },
    
    episodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { 
          title: { type: Type.STRING }, 
          oneLiner: { type: Type.STRING },
          aStory: { type: Type.STRING, description: "The main plot engine for this episode." },
          bStory: { type: Type.STRING, description: "The character/relationship subplot." },
          endState: { type: Type.STRING, description: "What has permanently changed by episode's end." },
        },
        required: ["title", "oneLiner", "aStory", "bStory", "endState"],
      }
    },
    
    episodeDetails: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        acts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { summary: { type: Type.STRING } },
            required: ["summary"],
          }
        }
      },
      required: ["summary", "acts"],
    },

    episodeFullStructure: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "Full episode summary. 2-3 sentences covering the dramatic arc.",
        },
        acts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: "The dramatic function of this act. One sentence.",
              },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title:       { type: Type.STRING },
                    summary:     { type: Type.STRING },
                    setting:     { type: Type.STRING },
                    dramaticWant:{ type: Type.STRING },
                    location:    { type: Type.STRING },
                    isExterior:  { type: Type.BOOLEAN },
                    timeOfDay:   {
                      type: Type.STRING,
                      enum: ['DAY', 'NIGHT', 'CONTINUOUS', 'LATER'],
                    },
                  },
                  required: ['title', 'summary'],
                },
              },
            },
            required: ['summary', 'scenes'],
          },
        },
      },
      required: ['summary', 'acts'],
    },
    
    actScenes: {
      type: Type.OBJECT,
      properties: {
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
            framing: {
              type: Type.OBJECT,
              description:
                "Thinking scaffold. Answer before writing prose. " +
                "Used for logging and validation; not persisted.",
              properties: {
                whatsAlreadyHappening: {
                  type: Type.STRING,
                  description:
                    "One sentence. Physical situation already in " +
                    "motion as the scene begins.",
                },
                oneShift: {
                  type: Type.STRING,
                  description:
                    "One change. Not three. What shifts once " +
                    "in this scene (someone enters, a rule is " +
                    "declared, a line is crossed, a paper is " +
                    "delivered, someone leaves).",
                },
                exitCondition: {
                  type: Type.STRING,
                  description:
                    "Physical event that ends the scene.",
                },
              },
              required: [
                "whatsAlreadyHappening",
                "oneShift",
                "exitCondition"
              ],
            },
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
              setting: { type: Type.STRING },
              dramaticWant: { type: Type.STRING },
              location: { type: Type.STRING },
              isExterior: { type: Type.BOOLEAN },
              timeOfDay: { type: Type.STRING, enum: ['DAY', 'NIGHT', 'CONTINUOUS', 'LATER'] },
            },
            required: ["framing", "title", "summary"],
          }
        }
      },
      required: ["scenes"]
    },
    
    cinematicBeats: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          framing: {
            type: Type.OBJECT,
            description:
              "Thinking scaffold. Answer before writing prose. " +
              "Used for logging and validation; not persisted.",
            properties: {
              beatFunction: {
                type: Type.STRING,
                description:
                  "One sentence. What changes physically.",
              },
              imageAnchor: {
                type: Type.STRING,
                description:
                  "The one thing the reader should remember seeing.",
              },
              whoMovesFirst: {
                type: Type.STRING,
                description: "Character name only.",
              },
              whatVisiblyChanges: {
                type: Type.STRING,
                description:
                  "One sentence. Physical result of the beat.",
              },
            },
            required: [
              "beatFunction","imageAnchor",
              "whoMovesFirst","whatVisiblyChanges"
            ],
          },
          beatType: { 
            type: Type.STRING, 
            enum: ["TABLEAU", "DIALOGUE", "ESTABLISHING"],
            description: "DIALOGUE = default; characters speak. TABLEAU = wordless beat, sparingly used. ESTABLISHING = first beat of new location, at most once per scene. DEFAULT TO DIALOGUE — most beats in most scenes should be DIALOGUE."
          },
          description: {
            type: Type.STRING,
            description:
              "Narrative prose describing the physical action " +
              "of this beat. Must pass the CONTENT_GENERATION_" +
              "STANDARD negative filter and quality check. " +
              "2–5 sentences, ~200-300 words max.",
          },
          visualDescription: {
            type: Type.STRING,
            description:
              "One image-prompt sentence following the template " +
              "[who] [does visible thing] in [place], while " +
              "[other visible thing]. 15-25 words. One clause.",
          },
          subtext: {
            type: Type.STRING,
            description:
              "Short and oppositional. Template: She is doing X. " +
              "He reads it as Y. Max 40 words. No essays.",
          },
          continuityAnchor: {
            type: Type.STRING,
            description:
              "VISUAL anchor per D235 — recurring visual element " +
              "for cross-panel consistency. Named location plus " +
              "ONE visual detail (visible objects, surface " +
              "conditions, light). NO sounds, smells, or feelings. " +
              "15-25 words.",
          },
          groundingEnsemble: { type: Type.STRING },
          characterNames: { type: Type.ARRAY, items: { type: Type.STRING } },
          dialogue: {
            type: Type.ARRAY,
            description: "MUST contain exactly ONE line of dialogue.",
            items: {
              type: Type.OBJECT,
              properties: { 
                characterName: { type: Type.STRING }, 
                text: { type: Type.STRING } 
              },
              required: ["characterName", "text"],
            }
          },
          direction: {
            type: Type.STRING,
            description:
              'One camera direction sentence. What the lens sees: framing, angle, subject. ' +
              'Present tense. No emotion, no tone, no character psychology. ' +
              'WRONG: "An intimate close-up capturing her vulnerability." ' +
              'RIGHT: "Low angle on her hands as she signs the document, ' +
              'his shoes visible at the frame edge." ' +
              'One sentence only. 10-20 words.',
          },
        },
        required: ["framing", "beatType", "description", "visualDescription", "subtext", "continuityAnchor", "groundingEnsemble", "characterNames", "dialogue", "direction"],
      }
    },

    dialogueScript: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          characterHandle: handleField,
          text: { type: Type.STRING, description: "The spoken line of dialogue." }
        },
        required: ["characterHandle", "text"]
      }
    },
    
    lineExchange: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          characterHandle: handleField,
          text: {
            type: Type.STRING,
            description: 'The spoken line of dialogue.'
          },
          parenthetical: {
            type: Type.STRING,
            description:
              'A physical action performed by THIS character between their lines. ' +
              'Written as a stage direction: present tense, third person singular, ' +
              'referring only to the character speaking this line. ' +
              'Examples: "sets down the wrench", "does not look at him", "laughs once, stops". ' +
              'NOT: "she grips the railing" when the speaker is Archivist. ' +
              'NOT a tone direction. NOT an emotion label. A visible physical action only. ' +
              'Empty string if no physical beat is needed.',
          }
        },
        required: ['characterHandle', 'text', 'parenthetical']
      }
    },
    beatVisualFields: {
      type: Type.OBJECT,
      properties: {
        description: {
          type: Type.STRING,
          description:
            "Atmospheric prose for the beat. Physical space, body language, " +
            "emotional subtext. 60-120 words. Not a retelling of the dialogue.",
        },
        visualDescription: {
          type: Type.STRING,
          description:
            "Compact image-generation descriptor for panel 1. 15-25 words. " +
            "Concrete and visual only. Subject, action, environment.",
        },
        direction: {
          type: Type.STRING,
          description:
            "Shot type and framing for panel 1. One line. " +
            "Format: SHOT TYPE: brief note.",
        },
        continuityAnchor: {
          type: Type.STRING,
          description:
            "Location name and one visual detail. One line. " +
            "Format: Location name -- visual detail.",
        },
      },
      required: [
        "description", "visualDescription", "direction", "continuityAnchor"
      ],
    },
    beatProductionFields: {
      type: Type.OBJECT,
      properties: {
        visualDescription: {
          type: Type.STRING,
          description:
            "Production-layer prose staging a drawable frame for image " +
            "generation. Names every character in characterIds, places " +
            "them in the frame, describes the physical action and result. " +
            "Follows the Content Generation Standard: no meaning-claims, " +
            "no muscle-level anatomy, readable expressions only. " +
            "Typical length 40-100 words.",
        },
        direction: {
          type: Type.STRING,
          description:
            "Single camera/framing note. Format: SHOT TYPE: brief note. " +
            "Examples: CLOSE-UP: Face fills frame. | MEDIUM SHOT: Two " +
            "characters across desk. | WIDE SHOT: Full environment.",
        },
      },
      required: ["visualDescription", "direction"],
    },
    beatPanelPlan: {
      type: Type.OBJECT,
      properties: {
        panels: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              shotType: { type: Type.STRING, description: "e.g. CLOSE-UP, MEDIUM SHOT, WIDE SHOT" },
              action: { type: Type.STRING, description: "Visual description of the action in this panel." },
              subtext: { type: Type.STRING, description: "Emotional subtext or internal state for this panel" },
              direction: { type: Type.STRING, description: "Camera or lighting direction for this panel" },
              dialogueIndices: { 
                type: Type.ARRAY, 
                items: { type: Type.INTEGER },
                description: "Indices of the dialogue lines from the input that should appear in this panel."
              },
              captionIndices: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Indices of the captions from the input that should appear in this panel."
              },
              characterPositions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    characterHandle: handleField,
                    zone: {
                      type: Type.STRING,
                      enum: [
                        'top-left', 'top-center', 'top-right',
                        'middle-left', 'middle-center', 'middle-right',
                        'bottom-left', 'bottom-center', 'bottom-right',
                      ],
                    },
                    depth: {
                      type: Type.STRING,
                      enum: ['foreground', 'midground', 'background'],
                    },
                    facing: {
                      type: Type.STRING,
                      enum: ['left', 'right', 'forward', 'away', 'up', 'down'],
                    },
                  },
                  required: ['characterHandle', 'zone', 'depth'],
                },
              },
            },
            required: ["shotType", "action", "dialogueIndices", "captionIndices", "characterPositions"]
          }
        },
        props: {
          type: Type.ARRAY,
          description: "Significant props appearing in 2+ panels.",
          items: {
            type: Type.OBJECT,
            properties: {
              label: {
                type: Type.STRING,
                description: "Short name: 'the hammer', 'the device'"
              },
              description: {
                type: Type.STRING,
                description: "Concrete visual description for consistent rendering across panels."
              },
              appearsInPanels: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "0-indexed panel numbers where this prop appears."
              },
            },
            required: ["label", "description", "appearsInPanels"]
          }
        }
      },
      required: ["panels"]
    },
    reconciledBeatDescription: {
      type: Type.OBJECT,
      properties: {
        description: {
          type: Type.STRING,
          description: "A clean, stageable beat description that reconciles all beat fields into a single prose block. 60-120 words. Focus on physical action, body language, and environment. No adverbs. No internal monologue. No redundant dialogue."
        }
      },
      required: ["description"]
    }
  };
}

// Backward-compat: static export for callers that do not yet pass show.
// These calls produce schemas without enum constraints (current behavior).
export const AI_SCHEMAS = buildSchemas();
export const schemas = AI_SCHEMAS;

