import { useState } from 'react';
import { Navbar, Nav, Container, Modal } from 'react-bootstrap';
import OnboardingForm from './Register';

export default function HomepageNavbar() {
  const [showRegister, setShowRegister] = useState(false);

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="/">Logo</Navbar.Brand>
          <Nav.Link onClick={() => setShowRegister(true)} style={{cursor: 'pointer'}}>
            Signup Now
          </Nav.Link>
        </Container>
      </Navbar>

      {/* Das Onboarding-Formular öffnet sich als Popup */}
      <Modal show={showRegister} onHide={() => setShowRegister(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Onboarding!</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <OnboardingForm />
        </Modal.Body>
      </Modal>
    </>
  );
}
