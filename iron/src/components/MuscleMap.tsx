import React from 'react';
import Model from 'react-body-highlighter';

interface MuscleMapProps {
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

// Map ExerciseDB muscle names → react-body-highlighter muscle names
const MUSCLE_MAP: Record<string, string[]> = {
  abs:                    ['abs'],
  adductors:              ['adductor'],
  biceps:                 ['biceps'],
  calves:                 ['calves'],
  delts:                  ['front-deltoids', 'back-deltoids'],
  forearms:               ['forearm'],
  glutes:                 ['gluteal'],
  hamstrings:             ['hamstring'],
  'hip flexors':          ['adductor'],
  lats:                   ['upper-back'],
  'levator scapulae':     ['trapezius'],
  pectorals:              ['chest'],
  quads:                  ['quadriceps'],
  'serratus anterior':    ['obliques'],
  spine:                  ['lower-back'],
  traps:                  ['trapezius'],
  triceps:                ['triceps'],
  'upper back':           ['upper-back'],
  neck:                   ['neck'],
  'cardiovascular system': [],
  back:                   ['upper-back', 'lower-back'],
  cardio:                 [],
  chest:                  ['chest'],
  'lower arms':           ['forearm'],
  'lower legs':           ['calves'],
  shoulders:              ['front-deltoids', 'back-deltoids'],
  'upper arms':           ['biceps', 'triceps'],
  'upper legs':           ['quadriceps', 'hamstring'],
  waist:                  ['abs'],
};

function toHighlighterMuscles(names: string[]): string[] {
  const result: string[] = [];
  for (const name of names) {
    const mapped = MUSCLE_MAP[name.toLowerCase().trim()] ?? [];
    result.push(...mapped);
  }
  return [...new Set(result)];
}

const MuscleMap: React.FC<MuscleMapProps> = ({ primaryMuscles, secondaryMuscles }) => {
  const primary   = toHighlighterMuscles(primaryMuscles);
  const secondary = toHighlighterMuscles(secondaryMuscles);

  // frequency=2 → primary (gold), frequency=1 → secondary (gray)
  // highlightedColors[0] = frequency 1, highlightedColors[1] = frequency 2
  const data: { name: string; muscles: string[]; frequency: number }[] = [
    ...primary.map(m   => ({ name: m, muscles: [m], frequency: 2 })),
    ...secondary.map(m => ({ name: m, muscles: [m], frequency: 1 })),
  ];

  if (data.length === 0) return null;

  const sharedProps = {
    data,
    bodyColor: '#1f2937',
    highlightedColors: ['#4b5563', '#fde047'], // [freq=1 secondary, freq=2 primary]
    style: { width: 110 },
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 text-xs text-gray-400">
        {primary.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block bg-yellow-300" />
            Primary
          </span>
        )}
        {secondary.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block bg-gray-600" />
            Secondary
          </span>
        )}
      </div>

      <div className="flex gap-2" style={{ filter: 'drop-shadow(0 0 6px rgba(253,224,71,0.15))' }}>
        <Model {...sharedProps} type="anterior" />
        <Model {...sharedProps} type="posterior" />
      </div>

      <div className="flex gap-6 text-[10px] text-gray-600 uppercase tracking-wider">
        <span>Front</span>
        <span>Back</span>
      </div>
    </div>
  );
};

export default MuscleMap;
