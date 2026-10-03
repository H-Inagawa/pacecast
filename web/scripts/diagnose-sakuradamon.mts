import { writeFileSync } from "node:fs";
import { proposeCoursesDiagnose } from "../lib/server/courseRoutes";

const start = { lat: 35.6776, lon: 139.7535 };
const distanceKm = 5;

const result = await proposeCoursesDiagnose(start, distanceKm, (finished, total, passed) => {
  process.stderr.write(`progress ${finished}/${total} passed=${passed}\n`);
});

const summary = {
  courses: result.courses.map((course) => ({
    distanceKm: course.distanceKm,
    score: course.score,
    featureKm: course.featureKm,
    signalCount: course.signalCount,
    coversPalace: result.diagnose.palaceInSelected > 0,
  })),
  diagnose: {
    alongFeatureWays: result.diagnose.alongFeatureWays,
    featureSectors: result.diagnose.featureSectors,
    poolCount: result.diagnose.poolCount,
    palaceInPool: result.diagnose.palaceInPool,
    palaceInSelected: result.diagnose.palaceInSelected,
    statusCounts: result.diagnose.considered.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.status] = (acc[entry.status] ?? 0) + 1;
      return acc;
    }, {}),
    palaceCandidates: result.diagnose.considered.filter((entry) => entry.coversPalace),
  },
};

writeFileSync(new URL("../../.tmp-course-diag.json", import.meta.url), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
