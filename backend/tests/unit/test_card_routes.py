import pytest

@pytest.mark.unit
class TestCardRoutes:
    def test_get_cards(self, client, sample_card):
        """Test getting cards list"""
        response = client.get('/api/cards')

        assert response.status_code == 200
        data = response.json
        assert data['total'] >= 1
        assert len(data['cards']) >= 1
        assert data['cards'][0]['name'] == 'Test Business'

    def test_get_cards_search(self, client, sample_card):
        """Test searching cards"""
        response = client.get('/api/cards?search=Test')

        assert response.status_code == 200
        data = response.json
        assert data['total'] >= 1
        assert 'Test' in data['cards'][0]['name']

    def test_get_cards_by_tag(self, client, sample_card):
        """Test filtering cards by tag"""
        response = client.get('/api/cards?tags=test-tag')

        assert response.status_code == 200
        data = response.json
        assert data['total'] >= 1
        assert 'test-tag' in data['cards'][0]['tags']

    def test_get_cards_featured_only(self, client, sample_card):
        """Test getting only featured cards"""
        response = client.get('/api/cards?featured=true')

        assert response.status_code == 200
        data = response.json
        assert all(card['featured'] for card in data['cards'])

    def test_get_card_by_id(self, client, sample_card):
        """Test getting single card"""
        response = client.get(f'/api/cards/{sample_card.id}')

        assert response.status_code == 200
        assert response.json['name'] == 'Test Business'

    def test_get_card_not_found(self, client, db_session):
        """Test getting non-existent card"""
        response = client.get('/api/cards/99999')

        assert response.status_code == 404

    def test_get_business_by_id(self, client, sample_card):
        """Test getting business by ID"""
        response = client.get(f'/api/business/{sample_card.id}')

        assert response.status_code == 200
        data = response.json
        assert data['name'] == 'Test Business'
        assert 'share_url' in data

    def test_get_business_with_slug(self, client, sample_card):
        """Test getting business with correct slug"""
        response = client.get(f'/api/business/{sample_card.id}/test-business')

        assert response.status_code == 200
        assert response.json['name'] == 'Test Business'

    def test_get_business_wrong_slug_redirects(self, client, sample_card):
        """Test wrong slug triggers redirect"""
        response = client.get(f'/api/business/{sample_card.id}/wrong-slug')

        assert response.status_code == 301
        assert 'redirect' in response.json

    def test_get_tags(self, client, sample_tag, sample_card):
        """Test getting tags list"""
        response = client.get('/api/tags')

        assert response.status_code == 200
        tags = response.json
        assert len(tags) >= 1
        assert any(tag['name'] == 'test-tag' for tag in tags)

    def test_submit_card_authenticated(self, client, user_token):
        """Test submitting card as authenticated user"""
        response = client.post('/api/submissions',
                              headers={'Authorization': f'Bearer {user_token}'},
                              json={
                                  'name': 'New Business',
                                  'description': 'New description',
                                  'website_url': 'https://newbiz.com'
                              })

        assert response.status_code == 201
        assert response.json['name'] == 'New Business'
        assert response.json['status'] == 'pending'

    def test_submit_card_unauthenticated(self, client):
        """Test submitting card without authentication"""
        response = client.post('/api/submissions', json={
            'name': 'New Business'
        })

        assert response.status_code == 401

    def test_get_user_submissions(self, client, user_token, db_session, regular_user):
        """Test getting user's submissions"""
        from app.models import CardSubmission

        submission = CardSubmission(
            name='My Submission',
            submitted_by=regular_user.id
        )
        db_session.session.add(submission)
        db_session.session.commit()

        response = client.get('/api/submissions',
                             headers={'Authorization': f'Bearer {user_token}'})

        assert response.status_code == 200
        submissions = response.json
        assert len(submissions) >= 1
        assert submissions[0]['name'] == 'My Submission'

    def test_suggest_card_edit(self, client, user_token, sample_card):
        """Test suggesting card edit"""
        response = client.post(f'/api/cards/{sample_card.id}/suggest-edit',
                              headers={'Authorization': f'Bearer {user_token}'},
                              json={
                                  'name': 'Updated Name',
                                  'description': 'Updated description'
                              })

        assert response.status_code == 201
        data = response.json
        assert 'modification' in data
        assert data['modification']['name'] == 'Updated Name'
