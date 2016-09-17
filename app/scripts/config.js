var Config = {

	Algolia: {
		ApplicationId: '27B57MBLO4',
		APIKey: 'b5e5a8c59bcef894668656bdef6f026b',
		IndexName: 'best_buy',
		Facets: [
			{name: 'categories', displayName: 'Category', type: 'disjunctive'},
			{name: 'brand', displayName: 'Brand', type: 'disjunctive'}, 
			{name: 'price', displayName: 'Price', type: 'slider'},
			{name: 'type', displayName: 'Type', type: 'conjunctive'}
		],
		HitsPerPage: 20
	},

	Display: {

	}

}