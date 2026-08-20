import type { IaModel } from '../models/ia'
import type { FeedbackPreference } from '../foundations/feedback'
import { ConceptA } from './conceptA/ConceptA'
import { ConceptB } from './conceptB/ConceptB'
import { ConceptC } from './conceptC/ConceptC'

/**
 * THE STAGE 7.5 CONCEPT REGISTRY.
 *
 * Three architectures, one model, one entry point. Storybook, the render tests
 * and the browser suite all go through here, so a concept that is added,
 * renamed or removed cannot silently drop out of review — which is how a
 * "three concepts" stage quietly becomes a two-concept stage.
 *
 * NO CONCEPT IS MARKED, PREFERRED, DEFAULTED TO OR ORDERED BY MERIT. The keys
 * are `a`, `b`, `c` and the order is alphabetical, because Stage 7.5 is a
 * selection stage and the selection is not this lane's to make.
 */
export type IaConceptKey = 'a' | 'b' | 'c'

export const IA_CONCEPTS: Readonly<
  Record<
    IaConceptKey,
    {
      readonly name: string
      readonly mentalModel: string
      readonly render: (props: {
        model: IaModel
        feedback?: FeedbackPreference
      }) => React.ReactElement
    }
  >
> = {
  a: {
    name: 'Competition Deck',
    mentalModel:
      'I am inside a competition. Everything I see belongs to it until I say otherwise.',
    render: (props) => <ConceptA {...props} />,
  },
  b: {
    name: 'Attention Inbox',
    mentalModel:
      'The product tells me what to do. Competitions are labels on the work.',
    render: (props) => <ConceptB {...props} />,
  },
  c: {
    name: 'Spine and Command',
    mentalModel:
      'There is one home and one way to jump anywhere. Hierarchy is a spine, not a set of tabs.',
    render: (props) => <ConceptC {...props} />,
  },
}

export const IA_CONCEPT_KEYS: readonly IaConceptKey[] = ['a', 'b', 'c']

export function IaConcept({
  concept,
  model,
  feedback,
}: {
  concept: IaConceptKey
  model: IaModel
  feedback?: FeedbackPreference
}) {
  return IA_CONCEPTS[concept].render({
    model,
    ...(feedback === undefined ? {} : { feedback }),
  })
}
