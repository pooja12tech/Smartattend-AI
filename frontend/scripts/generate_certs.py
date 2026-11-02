import os
import datetime
import ipaddress
from cryptography import x509
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

def generate_local_certs(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    
    ca_cert_path = os.path.join(output_dir, "ca.crt")
    ca_key_path = os.path.join(output_dir, "ca-key.pem")
    cert_path = os.path.join(output_dir, "localhost.pem")
    key_path = os.path.join(output_dir, "localhost-key.pem")

    # 1. Generate Local Root Certificate Authority (CA)
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_name = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "SmartAttend Local Development CA"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SmartAttend AI"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Security & Development")
    ])
    
    now = datetime.datetime.now(datetime.timezone.utc)
    ca_cert = (
        x509.CertificateBuilder()
        .subject_name(ca_name)
        .issuer_name(ca_name)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650))  # 10 years for local CA
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_cert_sign=True,
                crl_sign=True,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False
            ),
            critical=True
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()),
            critical=False
        )
        .sign(ca_key, hashes.SHA256())
    )

    # 2. Generate Localhost Leaf Certificate
    leaf_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    leaf_name = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SmartAttend AI"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Local Development")
    ])

    san_entries = [
        x509.DNSName("localhost"),
        x509.DNSName("*.localhost"),
        x509.DNSName("localhost.localdomain"),
        x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
        x509.IPAddress(ipaddress.IPv6Address("::1")),
        x509.IPAddress(ipaddress.IPv4Address("192.168.1.8")),
    ]

    leaf_cert = (
        x509.CertificateBuilder()
        .subject_name(leaf_name)
        .issuer_name(ca_name)
        .public_key(leaf_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=730))  # 2 years (Chromium max 825 days)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=True,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False
            ),
            critical=True
        )
        .add_extension(
            x509.ExtendedKeyUsage([
                ExtendedKeyUsageOID.SERVER_AUTH,
                ExtendedKeyUsageOID.CLIENT_AUTH
            ]),
            critical=False
        )
        .add_extension(
            x509.SubjectAlternativeName(san_entries),
            critical=False
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(leaf_key.public_key()),
            critical=False
        )
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),
            critical=False
        )
        .sign(ca_key, hashes.SHA256())
    )

    # 3. Write CA Files
    with open(ca_cert_path, "wb") as f:
        f.write(ca_cert.public_bytes(serialization.Encoding.PEM))
    with open(ca_key_path, "wb") as f:
        f.write(ca_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))

    # 4. Write Leaf Files (bundle leaf cert + CA into localhost.pem)
    fullchain_pem = (
        leaf_cert.public_bytes(serialization.Encoding.PEM) +
        ca_cert.public_bytes(serialization.Encoding.PEM)
    )
    with open(cert_path, "wb") as f:
        f.write(fullchain_pem)

    with open(key_path, "wb") as f:
        f.write(leaf_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))

    print(f"Certificates successfully generated in: {output_dir}")
    print(f"  CA Certificate (for Windows Trust): {ca_cert_path}")
    print(f"  Localhost Fullchain PEM:            {cert_path}")
    print(f"  Localhost Key PEM:                  {key_path}")

if __name__ == "__main__":
    certs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "certs"))
    generate_local_certs(certs_dir)

