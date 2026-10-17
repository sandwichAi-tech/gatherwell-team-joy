import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { RecipesPage } from '@/components/learn';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/learn_/recipes')({ head: () => gatherwellHead('learn'), component: () => <FeatureRoute flag="feature_learn"><RecipesPage /></FeatureRoute> });
