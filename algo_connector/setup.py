import setuptools

setuptools.setup(
    name='AutoStocks_IEX_wrapper',
    version='0.10',
    description='Python wrapper for IEX API and AutoStocks web app',
    packages = setuptools.find_packages(),
    author='Hamza Qadeer',
    author_email='hamza.qadeer@berkeley.edu',
    url='https://github.com/hqadeer/AutoStocks.git',
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    install_requires=[
        'requests'
    ]
)
