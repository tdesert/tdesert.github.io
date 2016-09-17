$(document).ready(function () {

	// Algolia setup
	var conjunctiveFacets = [];
	var disjunctiveFacets = [];
	Config.Algolia.Facets.forEach(function(facet) { 
		if (facet.type == 'conjunctive') conjunctiveFacets.push(facet.name);
		if (['disjunctive', 'slider', 'rating'].includes(facet.type)) disjunctiveFacets.push(facet.name);
	});

	var algolia = algoliasearch(Config.Algolia.ApplicationId, Config.Algolia.APIKey);
	var algoliaHelper = algoliasearchHelper(algolia, Config.Algolia.IndexName, {
		hitsPerPage: Config.Algolia.HitsPerPage,
		maxValuesPerFacet: 8,
		facets: conjunctiveFacets,
		disjunctiveFacets: disjunctiveFacets,
		index: Config.Algolia.IndexName
	});

// DOM Elements
var $searchInput = $('#search-input');
var $hits = $('#hits');
var $facets = $('#facets');
var $sortBySelect = $('#sort-by-select');
var $refinementTags = $('#refinement-tags');

// Templates
var hitsTemplate = Hogan.compile($('#hits-template').text());
var facetTemplate = Hogan.compile($('#facet-template').text());
var sliderTemplate = Hogan.compile($('#slider-template').text());
var ratingTemplate = Hogan.compile($('#rating-template').text());
var refinementTagTemplate = Hogan.compile($('#refinement-tag-template').text());



// SEARCH

$searchInput.on('input propertychange', function(e) {
	var query = e.currentTarget.value;
	algoliaHelper.setQuery(query).search();
});

// Search errors
algoliaHelper.on('error', function(error) {
	console.log(error);
});

// Search results
algoliaHelper.on('result', function(content, state) {
	renderHits(content);
	renderFacets(content, state);
	bindFacets(state);
});


/// Events binding

$sortBySelect.on('change', function(e) {
	e.preventDefault();
	algoliaHelper.setIndex(Config.Algolia.IndexName + $(this).val()).search();
});

$(document).on('click', '.facet-toggle', function(e) {
	e.preventDefault()
	algoliaHelper.toggleRefine($(this).data('facet'), $(this).data('value')).search();
});

$(document).on('click', '.refinement-tag', function(e) {
	e.preventDefault()
	if ($(this).data('isNumeric') === true) {
		algoliaHelper.removeNumericRefinement($(this).data('facet')).search();
	}
	else {
		algoliaHelper.toggleRefine($(this).data('facet'), $(this).data('value')).search();	
	}
});


///
/// Rendering functions
///

function renderHits(content) {
	$hits.html(hitsTemplate.render(content));
}

function renderFacets(content, state) {

	var facetsHtml = ''
	var refinementTags = []
	Config.Algolia.Facets.forEach(function(facet, idx) {
		var result = content.getFacetByName(facet.name);
		if (!result) return;

		if (facet.type == 'conjunctive' || facet.type == 'disjunctive') {
			var facetData = {
				facet: facet.name,
				title: facet.displayName,
				values: content.getFacetValues(facet.name, {sortBy: ['count:desc']}),
				isDisjunctive: facet.type == 'disjunctive'
			};
			facetsHtml += facetTemplate.render(facetData);

			var refinedValues = (facet.type == 'conjunctive') ? state.getConjunctiveRefinements(facet.name) : state.getDisjunctiveRefinements(facet.name)
			var tags = refinedValues.map(function(value) {
				return {
					value: value,
					title: value,
					facet: facet.name,
					isNumeric: false
				}
			});
			refinementTags = refinementTags.concat(tags);
		}

		else if (facet.type == 'slider') {
			var minValue = state.getNumericRefinement(facet.name, '>=') || result.stats.min;
			var maxValue = state.getNumericRefinement(facet.name, '<=') || result.stats.max;
			var sliderData = {
				facet: facet.name,
				title: facet.displayName,
				value: '[' + minValue + ', ' + maxValue + ']',
				min: result.stats.min,
				max: result.stats.max,
				step: 5
			};

			facetsHtml += sliderTemplate.render(sliderData);

			// Tag value
			var tag = formatNumericRefinementTag(state, facet.name);
			if (tag !== null) {
				refinementTags.push(tag);
			}
		}

		else if (facet.type == 'rating') {
			var currentRefinement = state.getNumericRefinement(facet.name, '>=') || []
			var values = content.getFacetValues(facet.name)
				.map(function(object) {
					return {
						value: object.name,
						isRefined: currentRefinement.includes(Number(object.name))
					}
				})
				.sort(function(a, b) {
					if (a.value > b.value) return 1;
					else if (a.value < b.value) return -1;
					return 0;
				});
			var ratingData = {
				title: facet.displayName,
				facet: facet.name,
				values: values
			};
			//console.log("rating values: ", content.getFacetValues(facet.name));
			facetsHtml += ratingTemplate.render(ratingData);
			console.log('rating values', values)
		}
	});

	$facets.html(facetsHtml);

	var refinementTagsHtml = '';
	refinementTags.forEach(function(tag) {
		refinementTagsHtml += refinementTagTemplate.render(tag);
	});
	$refinementTags.html(refinementTagsHtml);


	function formatNumericRefinementTag(state, facetName) {
		var min = state.getNumericRefinement(facetName, '>=')
		var max = state.getNumericRefinement(facetName, '<=')
		var minTagValue = min || '';
		var maxTagValue = max || '';
		var title = '';
		if (minTagValue.length > 0) {
			title += 'min: €' + minTagValue;
		}
		if (minTagValue.length > 0 && maxTagValue.length > 0) {
			title += ' - ';
		}
		if (maxTagValue.length > 0) {
			title += 'max: €' + maxTagValue;
		}
		if (title.length == 0) return null;
		
		return {
			title: title,
			value: '',
			facet: facetName,
			isNumeric: true
		};
	}
}

function bindFacets(state) {
	Config.Algolia.Facets.forEach(function(facet, idx) {
		if (facet.type == 'slider') {
			var $slider = $facets.find('#slider-' + facet.name);
			$slider.slider({})
				.on('slideStop', function(e) {
					var sliderData = $(this).data();
					var inputValues = $(this).val().split(',')
					var userValues = {
						min: Number(inputValues[0]),
						max: Number(inputValues[1])
					};
					var lowerBound = state.getNumericRefinement(facet.name, '>=');
					lowerBound = lowerBound && lowerBound[0] || sliderData.sliderMin;
					if (userValues.min !== lowerBound) {
						algoliaHelper.removeNumericRefinement(facet.name, '>=');
						algoliaHelper.addNumericRefinement(facet.name, '>=', userValues.min).search();
					}
					var upperBound = state.getNumericRefinement(facet.name, '<=');
					upperBound = upperBound && upperBound[0] || sliderData.sliderMax;
					if (userValues.max !== upperBound) {
						algoliaHelper.removeNumericRefinement(facet.name, '<=');
						algoliaHelper.addNumericRefinement(facet.name, '<=', userValues.max).search();
					}
				});
		}

		else if (facet.type == 'rating') {
			var $rating = $facets.find('#rating-' + facet.name);
			$rating.barrating({
				theme: 'bootstrap-stars',
				initialRating: null,
				allowEmpty: null,
				deselectable: true,
			});
			$rating.on('change', function() {
				console.log($(this).val());
				algoliaHelper.removeNumericRefinement(facet.name, '>=');
				algoliaHelper.addNumericRefinement(facet.name, '>=', $(this).val()).search();
			});
			console.log('rating dom: ', $rating);
		}
	});


}

 algoliaHelper.search();

});


