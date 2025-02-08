from PIL import Image
import os

def resize_image(input_file, output_prefix, sizes):
    """
    Resizes an image to multiple sizes defined in the sizes list.
    
    :param input_file: Path to the input image (PNG format)
    :param output_prefix: Prefix for output file names
    :param sizes: List of sizes (width, height) tuples
    """
    try:
        with Image.open(input_file) as img:
            output_dir = os.path.dirname(input_file)
            for size in sizes:
                resized_img = img.resize((size, size))
                output_filename = os.path.join(output_dir, f"{output_prefix}-{size}.png")
                resized_img.save(output_filename, format="PNG")
                print(f"Saved: {output_filename}")
    except Exception as e:
        print(f"Error: {e}")

# Define input file and sizes
input_png = "static/images/icons/app-icon.png"
sizes = [48, 57, 60, 76, 96, 120, 144, 152, 192, 256, 384, 512]  # List of sizes in pixels

# Call function
resize_image(input_png, "app-icon", sizes)