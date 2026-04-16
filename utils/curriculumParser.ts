import type { CurriculumUnit, SubjectCurriculum } from '../types';

export const parseCurriculumText = (text: string): CurriculumUnit[] => {
  const units: CurriculumUnit[] = [];
  let currentUnit: CurriculumUnit | null = null;

  text.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const unitMatch = trimmedLine.match(/^(?:\d+\.\s*)?(?:Unite|Tema|Ünite):\s*(.+)$/i);
    if (unitMatch) {
      currentUnit = { name: unitMatch[1].trim(), topics: [] };
      units.push(currentUnit);
      return;
    }

    const topicMatch = trimmedLine.match(/^[-*]\s*(?:Konu:)?\s*(.+)$/i);
    if (topicMatch && currentUnit) {
      currentUnit.topics.push({ name: topicMatch[1].trim(), completed: false });
    }
  });

  return units;
};

export const stringifyCurriculumForAI = (
  curriculum: SubjectCurriculum,
  selectedTopics?: { subject: string; topic: string }[]
): string => {
  if (selectedTopics && selectedTopics.length > 0) {
    const grouped = selectedTopics.reduce<Record<string, string[]>>((acc, item) => {
      if (!acc[item.subject]) acc[item.subject] = [];
      acc[item.subject].push(`- Konu: ${item.topic}`);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([subject, topics]) => `\n### ${subject}\n${topics.join('\n')}`)
      .join('');
  }

  return Object.entries(curriculum)
    .map(([subject, units]) => {
      const unitBlocks = units
        .map((unit) => {
          const openTopics = unit.topics
            .filter((topic) => !topic.completed)
            .map((topic) => `- Konu: ${topic.name}`);

          if (openTopics.length === 0) return null;
          return `${unit.name}:\n${openTopics.join('\n')}`;
        })
        .filter(Boolean);

      if (unitBlocks.length === 0) return null;
      return `\n### ${subject}\n${unitBlocks.join('\n')}`;
    })
    .filter(Boolean)
    .join('');
};