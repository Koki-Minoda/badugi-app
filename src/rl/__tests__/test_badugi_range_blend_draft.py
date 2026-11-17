"""Guarded posterior blend must preserve the public-only fallback exactly."""
import unittest

from rl.training.badugi_range_blend_draft import gated_public_range_probabilities


class RangeBlendTests(unittest.TestCase):
    def test_selected_group_blends_and_other_group_falls_back(self):
        args={'baseline':(0.2,0.6,0.15,0.05),
              'learned':(0.4,0.4,0.15,0.05),
              'selected_groups':(0,2,3,5,6,7),'weight':0.25}
        selected=gated_public_range_probabilities(group=2,**args)
        self.assertAlmostEqual(selected[0],0.25)
        self.assertAlmostEqual(sum(selected),1)
        self.assertEqual(gated_public_range_probabilities(group=8,**args),args['baseline'])

    def test_invalid_model_output_and_group_are_rejected(self):
        args={'baseline':(0.2,0.6,0.15,0.05),
              'learned':(0.4,0.4,0.15,0.05),
              'selected_groups':(0,2,3,5,6,7),'weight':0.25,'group':2}
        for invalid in ({'learned':(float('nan'),0.4,0.15,0.05)},
                        {'weight':1.1},{'selected_groups':(2,2)},{'group':11}):
            with self.subTest(invalid=invalid),self.assertRaises(ValueError):
                gated_public_range_probabilities(**{**args,**invalid})


if __name__=='__main__':
    unittest.main()
