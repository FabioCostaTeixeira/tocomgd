import unittest
from pathlib import Path

from PIL import Image

from tests.fixtures import MASK_DIMS, MASK_OUT, gerar_mascaras


class FixturesMasksTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        gerar_mascaras()

    def test_generates_rgba_masks_with_transparent_center(self):
        for format_id, dimensions in MASK_DIMS.items():
            mask_path = MASK_OUT / f"{format_id}.png"
            self.assertTrue(mask_path.is_file(), format_id)

            with Image.open(mask_path) as image:
                self.assertEqual(image.size, dimensions)
                self.assertEqual(image.mode, "RGBA")
                center = image.getpixel((dimensions[0] // 2, dimensions[1] // 2))
                self.assertEqual(center[3], 0)

    def test_masks_have_asymmetric_opaque_elements(self):
        for format_id in MASK_DIMS:
            with Image.open(MASK_OUT / f"{format_id}.png") as image:
                alpha = image.getchannel("A")
                left = alpha.crop((0, 0, image.width // 2, image.height))
                right = alpha.crop((image.width // 2, 0, image.width, image.height))
                self.assertNotEqual(left.tobytes(), right.tobytes(), format_id)


if __name__ == "__main__":
    unittest.main()
