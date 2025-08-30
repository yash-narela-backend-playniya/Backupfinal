// This service can be expanded for REST API calls if needed
export const getMatchOptions = async () => {
  try {
    const response = await fetch('/api/match-options');
    return await response.json();
  } catch (error) {
    console.error('Error fetching match options:', error);
    return [];
  }
};